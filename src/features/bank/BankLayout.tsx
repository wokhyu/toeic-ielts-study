import { NavLink, Outlet } from 'react-router-dom';
import { IconClock, IconGrowth, IconPencil, IconRepeat } from '../../components/icons.tsx';
import { tabClass } from '../../components/styles.ts';
import type { CourseId } from '../../lib/types.ts';
import { BankContext, SPEECH_LANG, type BankContextValue } from './context.ts';

const tab = tabClass;

/** Practice, exams and review for one course's question bank. */
export function BankLayout({ course, base, title }: { course: CourseId; base: string; title?: string }) {
  const value: BankContextValue = { course, base, lang: SPEECH_LANG[course] };
  return (
    <BankContext.Provider value={value}>
      {title && <h1 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h1>}
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <NavLink to={base} end className={tab}>
          <IconPencil size={15} /> Luyện theo chủ đề
        </NavLink>
        <NavLink to={`${base}/thi-thu`} className={tab}>
          <IconClock size={15} /> Thi thử
        </NavLink>
        <NavLink to={`${base}/on-lai`} className={tab}>
          <IconRepeat size={15} /> Ôn lại
        </NavLink>
        {/* TOEIC/IELTS show progress as a roadmap tab instead. */}
        {course === 'on-tap-11' && (
          <NavLink to={`${base}/tien-bo`} className={tab}>
            <IconGrowth size={15} /> Tiến bộ
          </NavLink>
        )}
      </nav>
      <Outlet />
    </BankContext.Provider>
  );
}
