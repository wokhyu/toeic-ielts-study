// AI feedback on one IELTS Writing submission, using the Gemini API (Google AI Studio).
//
// POST { submission_id } with the learner's session token.
// Secrets (supabase secrets set ...): GEMINI_API_KEY, optional GEMINI_MODEL.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import prompts from './prompts.json' with { type: 'json' };
import {
  FeedbackError,
  geminiRequest,
  parseFeedback,
  responseText,
  wordCount,
  type Feedback,
  type PromptText,
} from './core.ts';

const DEFAULT_MODEL = 'gemini-3.8-flash';
const MIN_WORDS = 50;

// Requests carry a bearer token, not cookies, so any origin may call.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const fail = (status: number, error: string) => reply(status, { error });

async function callGemini(key: string, model: string, prompt: PromptText, essay: string): Promise<Feedback> {
  // One retry when the answer is not usable JSON.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(geminiRequest(prompt, essay)),
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!res.ok) {
      console.error('gemini error', res.status, (await res.text()).slice(0, 800));
      throw new FeedbackError(
        `gemini http ${res.status}`,
        res.status === 429
          ? 'AI đang quá tải hoặc đã hết lượt miễn phí hôm nay. Bạn thử lại sau.'
          : res.status === 404
            ? 'Chưa cấu hình đúng model AI. Báo admin kiểm tra GEMINI_MODEL.'
            : 'Không gọi được AI. Bạn thử lại sau.',
      );
    }
    try {
      return parseFeedback(responseText(await res.json()), prompt.task);
    } catch (e) {
      if (attempt < 2 && e instanceof FeedbackError && e.message.startsWith('bad feedback')) continue;
      throw e;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'Chỉ nhận POST.');

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return fail(503, 'Tính năng AI chưa được bật (thiếu GEMINI_API_KEY).');
  const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'Bạn cần đăng nhập.');
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await asUser.auth.getUser(token);
  if (authError || !auth.user) return fail(401, 'Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại nhé.');
  const me = auth.user.id;

  let submissionId: number;
  try {
    submissionId = Number(((await req.json()) as { submission_id?: unknown }).submission_id);
  } catch {
    return fail(400, 'Yêu cầu không hợp lệ.');
  }
  if (!Number.isSafeInteger(submissionId) || submissionId <= 0) return fail(400, 'Thiếu mã bài nộp.');

  // Read as the learner, so row-level security applies.
  const { data: sub } = await asUser
    .from('submissions')
    .select('id, user_id, kind, prompt_id, text')
    .eq('id', submissionId)
    .maybeSingle();
  if (!sub || sub.user_id !== me || sub.kind !== 'writing' || typeof sub.text !== 'string') {
    return fail(404, 'Chỉ chủ bài mới nhận được nhận xét AI cho bài Writing của mình.');
  }

  const { data: existing } = await asUser
    .from('ai_feedback')
    .select('feedback, model, created_at')
    .eq('submission_id', submissionId)
    .maybeSingle();
  if (existing) return reply(200, existing);

  const prompt = (prompts as unknown as Record<string, PromptText>)[sub.prompt_id];
  if (!prompt) return fail(400, 'Không tìm thấy đề của bài này.');
  if (wordCount(sub.text) < MIN_WORDS) return fail(400, `Bài cần ít nhất ${MIN_WORDS} từ để AI nhận xét.`);

  const { data: left, error: quotaError } = await asUser.rpc('ai_quota_take', { p_kind: 'writing' });
  if (quotaError) {
    if (quotaError.message.includes('ai quota exceeded')) {
      return fail(429, 'Bạn đã dùng hết lượt nhận xét AI hôm nay. Mai quay lại nhé.');
    }
    if (quotaError.message.includes('not enrolled')) return fail(403, 'Bạn cần được duyệt vào khóa IELTS.');
    console.error('quota', quotaError);
    return fail(500, 'Có lỗi khi kiểm tra lượt dùng.');
  }

  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const feedback = await callGemini(key, model, prompt, sub.text);
    const created_at = new Date().toISOString();
    const { error: saveError } = await service.from('ai_feedback').insert({
      submission_id: submissionId,
      user_id: me,
      model,
      overall: feedback.overall,
      feedback,
      created_at,
    });
    if (saveError) throw saveError;
    return reply(200, { feedback, model, created_at, left });
  } catch (e) {
    console.error('writing-feedback', e);
    await service.rpc('ai_quota_refund', { p_user: me, p_kind: 'writing' });
    // Two requests at once: the other one saved first.
    const { data: saved } = await asUser
      .from('ai_feedback')
      .select('feedback, model, created_at')
      .eq('submission_id', submissionId)
      .maybeSingle();
    if (saved) return reply(200, saved);
    return fail(
      502,
      e instanceof FeedbackError ? e.userMessage : 'Có lỗi khi tạo nhận xét. Bạn thử lại sau.',
    );
  }
});
