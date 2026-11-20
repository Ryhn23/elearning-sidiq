import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, UserCircle2, Globe, CheckCircle2, XCircle, Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useToast } from '@/components/ui/useToast';

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Form profil
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Form password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Google
  const [googleBound, setGoogleBound] = useState<boolean | null>(null);
  const [unbinding, setUnbinding] = useState(false);

  // Pengaturan preferensi & notifikasi
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [language, setLanguage] = useState('id');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        setName(data.user.name ?? '');
        setPhone(data.user.phone ?? '');
        setBio(data.user.bio ?? '');
        setAvatarUrl(data.user.avatarUrl ?? '');
        setGoogleBound(!!data.user.googleId);
      } catch {
        /* interceptor sudah handle 401 */
      }

      try {
        const { data } = await api.get('/users/me/settings');
        if (data.settings) {
          setEmailNotifications(data.settings.emailNotifications ?? true);
          setTimezone(data.settings.timezone ?? 'Asia/Jakarta');
          setLanguage(data.settings.language ?? 'id');
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Notifikasi hasil bind Google (kembali dari redirect callback)
  useEffect(() => {
    const result = searchParams.get('google_bind');
    if (result === 'success') {
      toast('Akun Google berhasil dihubungkan.', 'success');
      setGoogleBound(true);
    } else if (result === 'error') {
      toast('Proses koneksi akun Google gagal. Coba lagi.', 'error');
    }
  }, [searchParams, toast]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/me', { name, phone, bio, avatarUrl });
      if (token) setAuth(data.user, token);
      toast('Profil berhasil disimpan.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Gagal menyimpan profil.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast('Password baru minimal 8 karakter.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Konfirmasi password tidak sama.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/auth/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password berhasil diganti.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Gagal mengganti password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleBindGoogle = async () => {
    try {
      const { data } = await api.post('/auth/me/google/bind');
      window.location.href = data.authUrl;
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Gagal memulai koneksi Google.', 'error');
    }
  };

  const handleUnbindGoogle = async () => {
    if (!window.confirm('Lepaskan akun Google? Anda tidak bisa login dengan Google lagi.')) return;
    setUnbinding(true);
    try {
      await api.delete('/auth/me/google/unbind');
      setGoogleBound(false);
      toast('Akun Google dilepas.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Gagal melepaskan akun Google.', 'error');
    } finally {
      setUnbinding(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/users/me/settings', { emailNotifications, timezone, language });
      toast('Pengaturan berhasil disimpan.', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error ?? 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </Link>

        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
            <UserCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Profil Pengguna</h1>
            {user && <p className="text-xs text-muted-foreground">{user.email}</p>}
          </div>
        </div>

        <div className="space-y-6">
          {/* Informasi Profil */}
          <Card>
            <CardHeader>
              <CardTitle>Informasi Profil</CardTitle>
              <CardDescription>Nama, kontak, dan bio yang tampil di platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Nama" required value={name} onChange={(e) => setName(e.target.value)} />
                  <Input label="Email" type="email" disabled value={user?.email ?? ''} hint="Email tidak dapat diubah." />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="No. Telepon (opsional)" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <Input label="URL Foto Profil (opsional)" type="url" placeholder="https://..." value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
                </div>
                <Textarea label="Bio (opsional)" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
                <Button type="submit" loading={savingProfile}>
                  {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Ganti Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Ganti Password
              </CardTitle>
              <CardDescription>
                Jika Anda masuk dengan Google dan belum punya password, gunakan{' '}
                <Link to="/forgot-password" className="font-medium text-primary-600 hover:underline">Lupa password</Link>{' '}
                untuk mengatur.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <Input label="Password Saat Ini" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Password Baru" type="password" required placeholder="Minimal 8 karakter" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <Input label="Ulangi Password Baru" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <Button type="submit" loading={savingPassword}>
                  {savingPassword ? 'Mengubah...' : 'Ubah Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Akun Google */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4" /> Akun Google
              </CardTitle>
              <CardDescription>Hubungkan akun Google untuk login lebih cepat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {googleBound === null ? (
                <p className="text-sm text-muted-foreground">Memuat status...</p>
              ) : googleBound ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> Akun Google terhubung
                  </span>
                  <Button variant="destructive" size="sm" loading={unbinding} onClick={handleUnbindGoogle}>
                    {unbinding ? 'Melepas...' : 'Lepas'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" /> Belum terhubung
                  </span>
                  <Button variant="outline" size="sm" onClick={handleBindGoogle}>
                    Hubungkan Google
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pengaturan Akun & Notifikasi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" /> Pengaturan Notifikasi & Akun
              </CardTitle>
              <CardDescription>Sesuaikan preferensi notifikasi email dan zona waktu Anda.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <label htmlFor="notif-toggle" className="cursor-pointer text-sm font-medium text-foreground">
                      Notifikasi Email
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Kirim email saat tugas dinilai, kuis selesai, atau pengumuman kursus diterbitkan.
                    </p>
                  </div>
                  <input
                    id="notif-toggle"
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Zona Waktu</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:border-primary-500 focus:outline-none"
                    >
                      <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                      <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                      <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Bahasa Tampilan</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground focus:border-primary-500 focus:outline-none"
                    >
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>

                <Button type="submit" loading={savingSettings}>
                  {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Logout */}
          <Card>
            <CardContent className="pt-0">
              <Button
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Keluar dari Akun
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
