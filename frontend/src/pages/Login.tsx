import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useToast } from '@/components/ui/useToast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20 bg-background/95 backdrop-blur">
        <CardHeader className="space-y-3 items-center text-center pb-4">
          <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-primary/10 p-2 shadow-inner">
            <img
              src="/logo.png"
              alt="Sidiq Logo"
              className="w-12 h-12 object-contain drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Sidiq <span className="text-primary font-extrabold">E-Learning</span>
            </CardTitle>
            <CardDescription className="mt-1">
              Sistem Informasi Pembelajaran Pesantren Terpadu
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email / Nomor Induk
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="nama@pesantren.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Kata Sandi
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Lupa kata sandi?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full font-semibold shadow-md">
              {loading ? 'Memverifikasi...' : 'Masuk ke E-Learning'}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">atau</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
            Lanjutkan dengan Akun Google
          </Button>

          {/* Quick link to SIDIQ portal */}
          <div className="mt-4 pt-3 border-t border-border text-center">
            <a
              href={import.meta.env.VITE_SIDIQ_URL || 'https://staging.sidiq.pages.dev'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <span>Login via SIDIQ ERP Portal</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Belum memiliki akun?{' '}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Daftar Mandiri
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
