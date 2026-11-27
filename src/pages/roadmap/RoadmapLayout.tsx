import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CourseArt } from '../../components/art/CourseArt.tsx';
import {
  IconBook,
  IconCalendar,
  IconCards,
  IconChart,
  IconGrowth,
  IconMic,
  IconPencil,
  IconSparkle,
  IconTarget,
  IconTrophy,
} from '../../components/icons.tsx';
import { tabClass } from '../../components/styles.ts';
import { Badge, Card, selectClass } from '../../components/ui.tsx';
import type { Program, Track } from '../../content/schema.ts';
import { scoring } from '../../content/index.ts';
import { useAuth } from '../../lib/auth-context.ts';
import type { RoadmapContext } from './context.ts';

const TITLES: Record<Program, string> = { toeic: 'TOEIC Listening & Reading', ielts: 'IELTS Academic' };

const tab = tabClass;

export function RoadmapLayout({ program, preview }: { program: Program; preview: boolean }) {
  const { enrollmentFor } = useAuth();
  const location = useLocation();
  const enrollment = preview ? undefined : enrollmentFor(program);
  const [previewTrack, setPreviewTrack] = useState<Track>('B');
  const usePreviewTrack = preview || enrollment?.status !== 'approved';
  const track = usePreviewTrack ? previewTrack : (enrollment?.track ?? null);
  const base = preview ? `/xem-truoc/${program}` : `/c/${program}`;

  const ctx: RoadmapContext = {
    program,
    title: TITLES[program],
    track,
    startDate: usePreviewTrack ? null : (enrollment?.start_date ?? null),
    enrollment,
    preview: usePreviewTrack,
    setPreviewTrack,
  };

  const onPlacement = location.pathname.endsWith('/bai-test');
  const threshold = track ? scoring[program].thresholds.find((t) => t.track === track) : undefined;

  return (
    <div>
      <div className="relative mb-5 overflow-hidden rounded-[var(--radius-card)] shadow-soft ring-1 ring-line">
        <CourseArt course={program} className="absolute inset-0 h-full w-full opacity-60" />
        <div className="relative flex flex-wrap items-center gap-3 bg-gradient-to-r from-surface via-surface/90 to-surface/30 px-5 py-5">
          <div className="mr-auto">
            <h1 className="text-2xl font-semibold tracking-tight">{TITLES[program]}</h1>
            {threshold && (
              <div className="mt-1.5">
                <Badge color="blue">
                  <IconTarget size={13} /> {threshold.label} · mục tiêu {threshold.target}
                </Badge>
              </div>
            )}
          </div>
          {usePreviewTrack && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Xem nhánh
              <select
                className={selectClass}
                value={previewTrack}
                onChange={(e) => setPreviewTrack(e.target.value as Track)}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
          )}
        </div>
      </div>
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {!preview && (
          <NavLink to={`${base}/hom-nay`} className={tab}>
            <IconSparkle size={15} /> Hôm nay
          </NavLink>
        )}
        {!preview && (
          <NavLink to={`${base}/luyen`} className={tab}>
            <IconPencil size={15} /> Luyện đề
          </NavLink>
        )}
        {!preview && program === 'ielts' && (
          <NavLink to={`${base}/viet-noi`} className={tab}>
            <IconMic size={15} /> Viết & Nói
          </NavLink>
        )}
        <NavLink to={`${base}/lo-trinh`} className={tab}>
          <IconCalendar size={15} /> Lộ trình
        </NavLink>
        <NavLink to={`${base}/bai-test`} className={tab}>
          <IconTarget size={15} /> Bài test đầu vào
        </NavLink>
        {!preview && (
          <>
            <NavLink to={`${base}/tien-bo`} className={tab}>
              <IconGrowth size={15} /> Tiến bộ
            </NavLink>
            <NavLink to={`${base}/flashcard`} className={tab}>
              <IconCards size={15} /> Flashcard
            </NavLink>
            <NavLink to={`${base}/diem-thi-thu`} className={tab}>
              <IconChart size={15} /> Điểm thi thử
            </NavLink>
            <NavLink to={`${base}/xep-hang`} className={tab}>
              <IconTrophy size={15} /> Xếp hạng
            </NavLink>
          </>
        )}
      </nav>
      {!preview && !usePreviewTrack && !track && !onPlacement && (
        <Card variant="soft" className="mb-5 flex items-start gap-3">
          <IconBook className="mt-0.5 shrink-0 text-warn" />
          <p className="text-sm">
            Bạn chưa được xếp nhánh. Vào{' '}
            <NavLink to={`${base}/bai-test`} className="font-medium text-brand-ink underline">
              Bài test đầu vào
            </NavLink>{' '}
            để nhập điểm thi thật hoặc làm bài test ngắn (khoảng 40 phút).
          </p>
        </Card>
      )}
      <Outlet context={ctx} />
    </div>
  );
}
