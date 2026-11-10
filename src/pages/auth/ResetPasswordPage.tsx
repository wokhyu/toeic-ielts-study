import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ErrorBox, Field, inputClass } from '../../components/ui.tsx';
import { db, errorMessage } from '../../lib/supabase.ts';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Mật khẩu cần ít nhất 8 ký tự.');
      return;
    }
    const { error: err } = await db().auth.updateUser({ password });
    if (err) setError(errorMessage(err));
    else navigate('/khoa-hoc', { replace: true });
  };

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Đặt mật khẩu mới</h1>
      <form className="space-y-3" onSubmit={(e) => void submit(e)}>
        <Field label="Mật khẩu mới">
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorBox message={error} />}
        <Button type="submit" className="w-full">
          Lưu mật khẩu
        </Button>
      </form>
    </Card>
  );
}
