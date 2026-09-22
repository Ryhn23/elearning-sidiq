import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  LogOut,
  X,
  ClipboardList,
  Award,
  UserCog,
  BarChart3,
  PlusCircle,
  Tags,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

function navItemsForRole(role: string): NavItem[] {
  switch (role) {
    case 'student':
      return [
        { to: '/student', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
        { to: '/student/courses', label: 'Kursus Saya', icon: <ClipboardList className="h-4 w-4" /> },
        { to: '/student/grades', label: 'Nilai Saya', icon: <Award className="h-4 w-4" /> },
        { to: '/student/certificates', label: 'Sertifikat', icon: <Award className="h-4 w-4" /> },
        { to: '/courses', label: 'Katalog Kursus', icon: <BookOpen className="h-4 w-4" /> },
      ];
    case 'teacher':
      return [
        { to: '/teacher', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
        { to: '/teacher/courses/new', label: 'Buat Kursus', icon: <PlusCircle className="h-4 w-4" /> },
        { to: '/courses', label: 'Katalog Kursus', icon: <BookOpen className="h-4 w-4" /> },
      ];
    case 'admin':
      return [
        { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
        { to: '/admin/users', label: 'Manajemen User', icon: <UserCog className="h-4 w-4" /> },
        { to: '/admin/courses', label: 'Manajemen Kursus', icon: <BookOpen className="h-4 w-4" /> },
        { to: '/admin/categories', label: 'Kategori', icon: <Tags className="h-4 w-4" /> },
        { to: '/admin/analytics', label: 'Analitik', icon: <BarChart3 className="h-4 w-4" /> },
        { to: '/courses', label: 'Katalog Kursus', icon: <BookOpen className="h-4 w-4" /> },
      ];
    default:
      return [];
  }
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const items = navItemsForRole(user?.role ?? '');

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <GraduationCap className="h-6 w-6 text-primary-600" />
          <span className="text-base font-bold text-foreground">E-Learning</span>
          <button className="ml-auto lg:hidden" onClick={onClose} aria-label="Tutup menu">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-1 rounded-md px-2 py-2">
            <Link
              to="/profile"
              title="Profil Saya"
              onClick={onClose}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">{user?.role}</p>
              </div>
            </Link>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Keluar"
              className="text-muted-foreground hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
