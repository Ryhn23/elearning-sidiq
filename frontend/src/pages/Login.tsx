import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/useToast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  // Error dari alur Google OAuth (redirect balik ke /login?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get('error');
    if (!googleError) return;
    const messages: Record<string, string> = {
      google_not_bound:
        'Akun Google Anda belum dihubungkan dengan akun di sini. Silakan login manual dulu, lalu hubungkan Google di halaman Profil.',
      google_failed: 'Login dengan Google gagal. Silakan coba lagi atau login manual.',
      google_state_invalid: 'Sesi Google tidak valid (mungkin kedaluwarsa). Silakan coba lagi.',
    };
    setError(messages[googleError] ?? messages.google_failed);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Login gagal. Periksa email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { data } = await api.get('/auth/google/login');
      window.location.href = data.authUrl;
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Login Google belum tersedia.', 'error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Selamat Datang</h1>
          <p className="text-sm text-muted-foreground">Masuk untuk melanjutkan belajar</p>
        </div>

        <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              required
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <div>
              <Input
                label="Password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <div className="mt-1.5 text-right">
                <Link to="/forgot-password" className="text-xs font-medium text-primary-600 hover:underline">
                  Lupa password?
                </Link>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">atau</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
            Lanjutkan dengan Google
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Belum punya akun?{' '}
          <Link to="/register" className="font-medium text-primary-600 hover:underline">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
