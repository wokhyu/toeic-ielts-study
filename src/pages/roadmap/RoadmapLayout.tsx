import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Badge, Card } from '../../components/ui.tsx';
import type { Program, Track } from '../../content/schema.ts';
import { scoring } from '../../content/index.ts';
import { useAuth } from '../../lib/auth-context.ts';
import type { RoadmapContext } from './context.ts';

const TITLES: Record<Program, string> = { toeic: 'TOEIC Listening & Reading', ielts: 'IELTS Academic' };

const tab = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`;

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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{TITLES[program]}</h1>
        {threshold && (
          <Badge color="blue">
            {threshold.label} · mục tiêu {threshold.target}
          </Badge>
        )}
        {usePreviewTrack && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Xem nhánh
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
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
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {!preview && (
          <NavLink to={`${base}/hom-nay`} className={tab}>
            Hôm nay
          </NavLink>
        )}
        <NavLink to={`${base}/lo-trinh`} className={tab}>
          Lộ trình
        </NavLink>
        <NavLink to={`${base}/bai-test`} className={tab}>
          Bài test đầu vào
        </NavLink>
        {!preview && (
          <>
            <NavLink to={`${base}/flashcard`} className={tab}>
              Flashcard
            </NavLink>
            <NavLink to={`${base}/diem-thi-thu`} className={tab}>
              Điểm thi thử
            </NavLink>
            <NavLink to={`${base}/xep-hang`} className={tab}>
              Xếp hạng
            </NavLink>
          </>
        )}
      </nav>
      {!preview && !usePreviewTrack && !track && !onPlacement && (
        <Card className="mb-5 border-l-4 border-amber-400">
          <p className="text-sm">
            Bạn chưa được xếp nhánh. Vào{' '}
            <NavLink to={`${base}/bai-test`} className="font-medium text-indigo-700 underline">
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
