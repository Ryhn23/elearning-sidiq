import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Buat Akun</h1>
          <p className="text-sm text-muted-foreground">Mulai perjalanan belajarmu hari ini</p>
        </div>

        <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
          <form onSubmit={handleRegister} className="space-y-4">
            <Input label="Nama Lengkap" required placeholder="Nama Anda" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" type="email" required placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Input label="Password" type="password" required placeholder="Minimal 8 karakter" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <Input label="Konfirmasi Password" type="password" required placeholder="Ulangi password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />

            <div>
              <span className="mb-1.5 block text-sm font-medium text-foreground">Daftar sebagai</span>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'teacher'] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors',
                      role === r
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {r === 'student' ? 'Mahasiswa' : 'Pengajar'}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Memproses...' : 'Daftar'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
