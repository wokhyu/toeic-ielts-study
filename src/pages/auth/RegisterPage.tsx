import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button, Card, ErrorBox, Field, inputClass } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth-context.ts';
import { db, errorMessage, isSupabaseConfigured } from '../../lib/supabase.ts';

export function RegisterPage() {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (session) return <Navigate to="/khoa-hoc" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Mật khẩu cần ít nhất 8 ký tự.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await db().auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    // With e-mail confirmation on, there is no session until the link is clicked.
    if (!data.session) setSent(true);
  };

  if (sent) {
    return (
      <Card className="mx-auto max-w-sm">
        <h1 className="text-xl font-semibold">Kiểm tra email</h1>
        <p className="mt-2 text-sm text-slate-600">
          Đã gửi link xác nhận tới <b>{email}</b>. Bấm link trong email rồi đăng nhập, sau đó chọn khóa học
          muốn đăng ký.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Tạo tài khoản</h1>
      <form className="space-y-3" onSubmit={(e) => void submit(e)}>
        <Field label="Tên hiển thị">
          <input
            className={inputClass}
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Mật khẩu" hint="Ít nhất 8 ký tự">
          <input
            className={inputClass}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorBox message={error} />}
        <Button type="submit" className="w-full" disabled={busy || !isSupabaseConfigured}>
          Đăng ký
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Đã có tài khoản?{' '}
        <Link to="/dang-nhap" className="text-indigo-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </Card>
  );
}
