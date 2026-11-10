import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, ErrorBox, Field, inputClass } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth-context.ts';
import { db, errorMessage, isSupabaseConfigured } from '../../lib/supabase.ts';

export function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/khoa-hoc';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  if (session) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await db().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(/invalid/i.test(err.message) ? 'Sai email hoặc mật khẩu.' : errorMessage(err));
      return;
    }
    navigate(from, { replace: true });
  };

  const forgot = async () => {
    if (!email) {
      setError('Nhập email trước rồi bấm "Quên mật khẩu".');
      return;
    }
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}#/doi-mat-khau`;
    const { error: err } = await db().auth.resetPasswordForEmail(email, { redirectTo });
    if (err) setError(errorMessage(err));
    else setResetSent(true);
  };

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Đăng nhập</h1>
      <form className="space-y-3" onSubmit={(e) => void submit(e)}>
        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Mật khẩu">
          <input
            className={inputClass}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorBox message={error} />}
        {resetSent && <p className="text-sm text-emerald-700">Đã gửi email đặt lại mật khẩu.</p>}
        <Button type="submit" className="w-full" disabled={busy || !isSupabaseConfigured}>
          Đăng nhập
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" className="text-indigo-700 hover:underline" onClick={() => void forgot()}>
          Quên mật khẩu
        </button>
        <Link to="/dang-ky" className="text-indigo-700 hover:underline">
          Tạo tài khoản
        </Link>
      </div>
    </Card>
  );
}
