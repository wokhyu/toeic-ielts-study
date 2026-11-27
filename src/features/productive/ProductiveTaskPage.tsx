import { Link, Navigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconPencil } from '../../components/icons.tsx';
import { buttonClass } from '../../components/styles.ts';
import { Badge, Card, EmptyState } from '../../components/ui.tsx';
import { roadmaps, speakingSets, writingPrompts } from '../../content/index.ts';
import { findTask } from '../../lib/roadmap.ts';
import { IELTS_BASE } from './data.ts';

/** `viet-noi/nv/:taskId`: where a Writing, Speaking or review task's "Làm ngay" button lands. */
export function ProductiveTaskPage() {
  const { taskId = '' } = useParams();
  const found = findTask(roadmaps.ielts, taskId);
  const kind = found?.task.practice?.kind;
  const nv = `nv=${encodeURIComponent(taskId)}`;

  if (!found || (kind !== 'writing' && kind !== 'speaking' && kind !== 'review')) {
    return <EmptyState title="Không tìm thấy nhiệm vụ này" mood="thinking" />;
  }
  if (kind === 'review') return <Navigate to={`${IELTS_BASE}/viet-noi?tab=cham-cheo&${nv}`} replace />;
  if (kind === 'speaking') {
    const set = speakingSets.find((s) => s.week === found.week);
    return set ? (
      <Navigate to={`${IELTS_BASE}/noi/${set.id}?${nv}`} replace />
    ) : (
      <EmptyState title="Tuần này chưa có bộ câu hỏi Speaking" />
    );
  }

  const prompts = writingPrompts.filter((p) => p.week === found.week);
  return (
    <div className="space-y-4">
      <Link
        to={`${IELTS_BASE}/hom-nay`}
        className="inline-flex items-center gap-1 text-sm text-brand-ink hover:underline"
      >
        <IconArrowLeft size={15} /> Hôm nay
      </Link>
      <div>
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Tuần {found.week}</p>
        <h1 className="text-lg font-semibold text-ink">{found.task.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Chọn một đề của tuần. Nộp bài xong, nhiệm vụ tự được tích.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {prompts.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              <Badge color={p.task === 1 ? 'lilac' : 'coral'}>Task {p.task}</Badge>
              <Badge>
                {p.minutes} phút · ≥ {p.min_words} từ
              </Badge>
            </div>
            <p className="font-medium text-ink">{p.title_vi}</p>
            <Link
              to={`${IELTS_BASE}/viet/${p.id}?${nv}`}
              className={`${buttonClass('primary', 'sm')} mt-auto self-start`}
            >
              <IconPencil size={14} /> Viết đề này
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
