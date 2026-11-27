/** IELTS assessment criteria used by peer review (and, later, AI feedback). */
export interface Criterion {
  code: string;
  name: string;
  /** What to look at, in Vietnamese. */
  hint: string;
}

const CC: Criterion = {
  code: 'CC',
  name: 'Coherence & Cohesion · Mạch lạc, liên kết',
  hint: 'Chia đoạn hợp lý, mỗi đoạn một ý chính; ý nối nhau tự nhiên; từ nối đa dạng và dùng đúng.',
};
const LR: Criterion = {
  code: 'LR',
  name: 'Lexical Resource · Từ vựng',
  hint: 'Từ đa dạng và chính xác, collocation tự nhiên, paraphrase được đề; ít lỗi chính tả.',
};
const GRA: Criterion = {
  code: 'GRA',
  name: 'Grammatical Range & Accuracy · Ngữ pháp',
  hint: 'Kết hợp câu đơn và câu phức; phần lớn câu không lỗi; lỗi (nếu có) không gây khó hiểu.',
};

export function writingCriteria(task: 1 | 2): Criterion[] {
  const first: Criterion =
    task === 1
      ? {
          code: 'TA',
          name: 'Task Achievement · Hoàn thành yêu cầu',
          hint: 'Có overview nêu đặc điểm chính; chọn số liệu tiêu biểu và so sánh; không nêu ý kiến cá nhân.',
        }
      : {
          code: 'TR',
          name: 'Task Response · Trả lời đúng đề',
          hint: 'Trả lời đủ mọi phần của đề; quan điểm rõ xuyên suốt; mỗi ý có giải thích và ví dụ.',
        };
  return [first, CC, LR, GRA];
}

export const SPEAKING_CRITERIA: Criterion[] = [
  {
    code: 'FC',
    name: 'Fluency & Coherence · Trôi chảy, mạch lạc',
    hint: 'Nói liền mạch, ít ngập ngừng; trả lời có phát triển ý; dùng từ nối tự nhiên.',
  },
  LR,
  GRA,
  {
    code: 'P',
    name: 'Pronunciation · Phát âm',
    hint: 'Dễ nghe; âm cuối, trọng âm và ngữ điệu tự nhiên; giọng địa phương không làm khó hiểu.',
  },
];

/** A short reminder of what common bands mean, shown above the review form. */
export const BAND_GUIDE = [
  { band: 5, text: 'Hiểu được ý chính nhưng lỗi nhiều, ý còn sơ sài.' },
  { band: 6, text: 'Đủ ý, có cố gắng dùng cấu trúc và từ đa dạng; lỗi chưa gây khó hiểu.' },
  { band: 7, text: 'Linh hoạt, phát triển ý tốt, chỉ thỉnh thoảng có lỗi.' },
  { band: 8, text: 'Rất tự nhiên và chính xác, gần như không lỗi đáng kể.' },
];
