import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface RequireRoleProps {
  role: 'student' | 'teacher' | 'admin';
  children: React.ReactNode;
}

/** Blok akses jika role user tidak sesuai. Redirect ke dashboard role-nya sendiri. */
export function RequireRole({ role, children }: RequireRoleProps) {
  const user = useAuthStore((s) => s.user);

  if (!user || user.role !== role) {
    // Path dashboard per role: /teacher, /admin, /student (bukan /{role}/dashboard)
    return <Navigate to={`/${user?.role ?? 'student'}`} replace />;
  }
  return <>{children}</>;
}
