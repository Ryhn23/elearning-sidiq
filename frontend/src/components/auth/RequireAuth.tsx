import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/** Blok akses jika belum login. Simpan lokasi asal untuk redirect balik. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
