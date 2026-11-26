import { NavLink, Outlet } from 'react-router-dom';
import type { CourseId } from '../../lib/types.ts';
import { BankContext, SPEECH_LANG, type BankContextValue } from './context.ts';

const tab = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`;

/** Practice, exams and review for one course's question bank. */
export function BankLayout({ course, base, title }: { course: CourseId; base: string; title?: string }) {
  const value: BankContextValue = { course, base, lang: SPEECH_LANG[course] };
  return (
    <BankContext.Provider value={value}>
      {title && <h1 className="mb-4 text-2xl font-semibold">{title}</h1>}
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <NavLink to={base} end className={tab}>
          Luyện theo chủ đề
        </NavLink>
        <NavLink to={`${base}/thi-thu`} className={tab}>
          Thi thử
        </NavLink>
        <NavLink to={`${base}/on-lai`} className={tab}>
          Ôn lại
        </NavLink>
      </nav>
      <Outlet />
    </BankContext.Provider>
  );
}
