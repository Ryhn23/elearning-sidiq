import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Badge } from '@/components/ui/Badge';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Award,
  UserCog,
  BarChart3,
  PlusCircle,
  Tags,
  Users,
  X,
  GraduationCap,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

function navItemsForRole(role: string): NavItem[] {
  switch (role) {
    case 'student':
      return [
        { to: '/student', label: 'Dasbor Santri', icon: LayoutDashboard, end: true },
        { to: '/student/courses', label: 'Kursus Saya', icon: ClipboardList },
        { to: '/student/grades', label: 'Rekap Nilai', icon: Award },
        { to: '/student/certificates', label: 'Sertifikat Kelulusan', icon: GraduationCap },
        { to: '/courses', label: 'Katalog Kursus', icon: BookOpen },
      ];
    case 'teacher':
      return [
        { to: '/teacher', label: 'Dasbor Guru', icon: LayoutDashboard, end: true },
        { to: '/teacher/courses', label: 'Kursus Asuhan', icon: BookOpen },
        { to: '/teacher/courses/new', label: 'Buat Kursus Baru', icon: PlusCircle },
        { to: '/teacher/students', label: 'Santri & Rekap', icon: Users },
        { to: '/courses', label: 'Katalog Kursus', icon: BookOpen },
      ];
    case 'admin':
      return [
        { to: '/admin', label: 'Dasbor Admin', icon: LayoutDashboard, end: true },
        { to: '/admin/users', label: 'Manajemen Pengguna', icon: UserCog },
        { to: '/admin/courses', label: 'Manajemen Kursus', icon: BookOpen },
        { to: '/admin/categories', label: 'Kategori Kursus', icon: Tags },
        { to: '/admin/analytics', label: 'Analitik & Laporan', icon: BarChart3 },
        { to: '/courses', label: 'Katalog Kursus', icon: BookOpen },
      ];
    default:
      return [{ to: '/courses', label: 'Katalog Kursus', icon: BookOpen }];
  }
}

interface SidebarProps {
  isCollapsed?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  open?: boolean; // backwards compatibility
  onClose?: () => void; // backwards compatibility
}

export function Sidebar({
  isCollapsed = false,
  mobileOpen,
  onCloseMobile,
  open,
  onClose,
}: SidebarProps) {
  const isMobileOpen = mobileOpen ?? open ?? false;
  const handleClose = onCloseMobile ?? onClose;
  const user = useAuthStore((s) => s.user);
  const items = navItemsForRole(user?.role ?? '');

  const roleLabel =
    user?.role === 'admin'
      ? 'Administrator'
      : user?.role === 'teacher'
        ? 'Guru / Ustadz'
        : 'Santri';

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Aside Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card text-card-foreground shadow-sm transition-all duration-300 ease-in-out',
          // Mobile state
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0',
          // Desktop collapsible state
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
        )}
      >
        {/* Brand Header (matching SIDIQ) */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Link
            to="/dashboard"
            className={cn(
              'flex items-center gap-3 overflow-hidden transition-colors',
              isCollapsed && 'lg:justify-center lg:w-full',
            )}
          >
            <img
              src="/logo.png"
              alt="Sidiq Logo"
              className="h-8 w-8 shrink-0 object-contain drop-shadow-sm"
              onError={(e) => {
                // Fallback icon if logo not found
                e.currentTarget.style.display = 'none';
              }}
            />
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col text-left truncate">
                <span className="text-lg font-bold leading-none text-primary">Sidiq</span>
                <span className="text-[0.68rem] text-muted-foreground font-medium mt-1 leading-none tracking-tight">
                  E-Learning LMS
                </span>
              </div>
            )}
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label="Tutup Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items (ScrollArea) */}
        <ScrollArea className="flex-1 py-4">
          <nav className="grid gap-1 px-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={handleClose}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      isCollapsed && 'lg:justify-center lg:px-2',
                    )
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {(!isCollapsed || isMobileOpen) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Mini Profile Footer */}
        <div className="border-t border-border p-3">
          <Link
            to="/profile"
            onClick={handleClose}
            title={isCollapsed ? `${user?.name} (${roleLabel})` : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent',
              isCollapsed && 'lg:justify-center lg:p-1.5',
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {userInitial}
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold leading-tight text-foreground">
                  {user?.name ?? 'Pengguna'}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
