import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const COOKIE_NAME = 'el_google_auth';

function readCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0`;
}

/**
 * Handler callback login Google.
 * Backend men-set cookie sementara `el_google_auth` (maks. 10 menit) berisi
 * { at, rt } lalu redirect ke halaman ini. Di sini kita:
 *   1. ambil token dari cookie → simpan ke localStorage
 *   2. muat profil user via /auth/me
 *   3. hapus cookie → arahkan ke dashboard
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const fail = () => {
      clearCookie(COOKIE_NAME);
      navigate('/login?error=google_failed', { replace: true });
    };

    const raw = readCookie(COOKIE_NAME);
    if (!raw) {
      fail();
      return;
    }

    let at: string | undefined;
    let rt: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { at?: string; rt?: string };
      at = parsed.at;
      rt = parsed.rt;
    } catch {
      fail();
      return;
    }
    if (!at || !rt) {
      fail();
      return;
    }

    // Simpan sesi, lalu verifikasi dengan /me (interceptor memakai token ini)
    localStorage.setItem('token', at);
    localStorage.setItem('refreshToken', rt);

    api
      .get('/auth/me')
      .then(({ data }) => {
        setAuth(data.user, at, rt);
        clearCookie(COOKIE_NAME);
        navigate('/dashboard', { replace: true });
      })
      .catch(fail);
  }, [navigate, setAuth]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-muted-foreground">Menyelesaikan login Google...</p>
      </div>
    </div>
  );
}
