import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { IconBook, IconChart, IconPencil, IconTarget, IconUsers } from '../../components/icons.tsx';
import { tabClass } from '../../components/styles.ts';

/** Admin area: class overview, learners, question quality, accounts and the answer-key review. */
export function AdminLayout() {
  const { search } = useLocation();
  // Keep the chosen course (?khoa=…) when switching between analytics tabs.
  const keep = (path: string) => `${path}${search}`;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quản trị</h1>
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <NavLink to={keep('/admin')} end className={tabClass}>
          <IconChart size={15} /> Tổng quan
        </NavLink>
        <NavLink to={keep('/admin/hoc-vien')} className={tabClass}>
          <IconUsers size={15} /> Học viên
        </NavLink>
        <NavLink to={keep('/admin/cau-hoi')} className={tabClass}>
          <IconTarget size={15} /> Chất lượng câu hỏi
        </NavLink>
        <NavLink to="/admin/tai-khoan" className={tabClass}>
          <IconPencil size={15} /> Tài khoản & duyệt
        </NavLink>
        <NavLink to="/admin/duyet-dap-an" className={tabClass}>
          <IconBook size={15} /> Đáp án Ôn tập 11
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
