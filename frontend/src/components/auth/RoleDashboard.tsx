import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/** Redirect /dashboard ke dashboard sesuai role user. */
export function RoleDashboard() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'student';
  return <Navigate to={`/${role}`} replace />;
}
