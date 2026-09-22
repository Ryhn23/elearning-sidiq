import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * Pulihkan sesi dari token yang tersimpan (refresh halaman).
 * Mengembalikan `restoring=true` selama user belum dimuat —
 * agar redirect berbasis role tidak terjadi prematur.
 */
export function useSession() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [restoring, setRestoring] = useState<boolean>(!!token && !user);

  useEffect(() => {
    if (!token || user) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) setAuth(data.user, token);
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user, setAuth, logout]);

  return { restoring };
}
