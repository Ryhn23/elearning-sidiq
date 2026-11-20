import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md rounded-2xl border border-border p-6 text-center shadow-sm">
          <p className="mb-4 text-sm text-muted-foreground">
            Tautan reset password tidak valid atau hilang. Silakan ajukan permohonan tautan baru.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Ajukan Tautan Reset Baru
          </Link>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Gagal mengatur ulang password. Tautan mungkin sudah kadaluarsa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border border-border shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <img src="/logo.png" alt="Sidiq" className="h-10 w-10 object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Atur Ulang Password</CardTitle>
            <CardDescription className="text-sm">
              Buat password baru yang aman untuk akun Sidiq E-Learning Anda
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Password Baru"
                type="password"
                required
                minLength={8}
                placeholder="Minimal 8 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Input
                label="Konfirmasi Password Baru"
                type="password"
                required
                minLength={8}
                placeholder="Ulangi password baru"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />

              {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? 'Memproses...' : 'Simpan Password Baru'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/login" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Halaman Masuk
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
