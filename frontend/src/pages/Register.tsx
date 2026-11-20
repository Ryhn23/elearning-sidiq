import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

type Role = 'student' | 'teacher';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password, role });
      // Login otomatis setelah register sukses
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Registrasi gagal. Silakan coba lagi.');
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
            <CardTitle className="text-2xl font-bold tracking-tight">Buat Akun Baru</CardTitle>
            <CardDescription className="text-sm">
              Mulai perjalanan belajar mandiri di Sidiq E-Learning
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleRegister} className="space-y-4">
              <Input
                label="Nama Lengkap"
                required
                placeholder="Nama Anda"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Email"
                type="email"
                required
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                required
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Input
                label="Konfirmasi Password"
                type="password"
                required
                placeholder="Ulangi password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Daftar Sebagai
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['student', 'teacher'] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={cn(
                        'rounded-xl border py-2.5 text-xs font-semibold transition-all',
                        role === r
                          ? 'border-primary bg-primary/10 text-primary shadow-xs'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      {r === 'student' ? 'Santri / Siswa' : 'Ustadz / Pengajar'}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? 'Memproses...' : 'Daftar Sekarang'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Sudah punya akun?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Masuk di sini
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
