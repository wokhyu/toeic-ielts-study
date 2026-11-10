import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.ts';
import { isSupabaseConfigured } from '../lib/supabase.ts';
import { Button, Notice } from './ui.tsx';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`;

export function Layout() {
  const { session, profile, isAdmin, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/" className="mr-2 text-base font-semibold text-indigo-700">
            Học nhóm
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            <NavLink to="/khoa-hoc" className={linkClass}>
              Khóa học
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={linkClass}>
                Quản trị
              </NavLink>
            )}
          </nav>
          {session ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">{profile?.display_name}</span>
              <Button variant="secondary" onClick={() => void signOut()}>
                Đăng xuất
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <NavLink to="/dang-nhap" className={linkClass}>
                Đăng nhập
              </NavLink>
              <Link
                to="/dang-ky"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {!isSupabaseConfigured && (
          <div className="mb-4">
            <Notice>
              Bản build này chưa kết nối Supabase nên chưa đăng nhập được. Vẫn xem trước được lộ trình và bài
              test của TOEIC/IELTS.
            </Notice>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
