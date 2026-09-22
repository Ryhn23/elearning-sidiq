import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Lupa Password</h1>
        </div>

        <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Jika email <span className="font-medium text-foreground">{email}</span> terdaftar,
                tautan reset password telah dikirim. Periksa inbox (dan folder spam) Anda.
              </p>
              <Link to="/login" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Kembali ke halaman login
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur ulang password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" loading={loading} className="w-full">
                  {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link to="/login" className="font-medium text-primary-600 hover:underline">
                  Kembali ke halaman login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
