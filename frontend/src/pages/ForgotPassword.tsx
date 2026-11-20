import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Gagal mengirim tautan reset password.');
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
            <CardTitle className="text-2xl font-bold tracking-tight">Lupa Password</CardTitle>
            <CardDescription className="text-sm">
              Kami akan mengirim tautan untuk mengatur ulang password akun Anda
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Jika email <span className="font-semibold text-foreground">{email}</span> terdaftar,
                  tautan reset password telah dikirim. Silakan periksa kotak masuk (atau folder spam).
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline pt-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Kembali ke Halaman Masuk
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email Akun"
                  type="email"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />

                {error && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" loading={loading} className="w-full">
                  {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
                </Button>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  <Link to="/login" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Halaman Masuk
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
