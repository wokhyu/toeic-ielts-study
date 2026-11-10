import { NavLink, Outlet } from 'react-router-dom';

const tab = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`;

export function OtLayout() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Ôn tập Toán · Lý · Hóa 11</h1>
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <NavLink to="/c/on-tap-11" end className={tab}>
          Luyện theo chủ đề
        </NavLink>
        <NavLink to="/c/on-tap-11/thi-thu" className={tab}>
          Thi thử
        </NavLink>
        <NavLink to="/c/on-tap-11/on-lai" className={tab}>
          Ôn lại
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
