import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.ts';
import { isSupabaseConfigured } from '../lib/supabase.ts';
import { useTheme } from '../lib/useTheme.ts';
import { Mascot } from './art/Mascot.tsx';
import { IconMoon, IconSun } from './icons.tsx';
import { buttonClass } from './styles.ts';
import { Button, Notice } from './ui.tsx';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-soft hover:bg-muted hover:text-ink'
  }`;

function initials(name: string | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-soft ring-1 ring-line transition hover:bg-muted hover:text-ink"
      aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={dark ? 'Giao diện sáng' : 'Giao diện tối'}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

export function Layout() {
  const { session, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2.5">
          <Link to="/" className="mr-1 flex items-center gap-2 text-base font-semibold text-ink">
            <Mascot mood="happy" size={34} decorative />
            <span>
              Học <span className="text-brand-ink">nhóm</span>
            </span>
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
          <ThemeToggle />
          {session ? (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
                title={profile?.display_name}
                aria-hidden="true"
              >
                {initials(profile?.display_name)}
              </span>
              <span className="hidden text-ink-soft sm:inline">{profile?.display_name}</span>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Đăng xuất
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <NavLink to="/dang-nhap" className={linkClass}>
                Đăng nhập
              </NavLink>
              <Link to="/dang-ky" className={buttonClass('primary', 'sm')}>
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </header>
      <main
        key={location.pathname.split('/').slice(0, 3).join('/')}
        className="mx-auto max-w-5xl animate-rise px-4 py-6"
      >
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
      <footer className="mx-auto max-w-5xl px-4 pt-4 pb-8 text-center text-xs text-ink-faint">
        Học đều mỗi ngày một chút, Bé Cú tin bạn làm được.
      </footer>
    </div>
  );
}
