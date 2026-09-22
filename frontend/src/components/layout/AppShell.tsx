import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { NotificationBell } from './NotificationBell';

interface AppShellProps {
  children: React.ReactNode;
}

/** Kerangka halaman terautentikasi: sidebar + topnav (mobile) + area konten. */
export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-muted/40">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* Header desktop */}
      <header className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-background/95 px-6 backdrop-blur lg:flex">
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="h-6 w-px bg-border" />
          <span className="text-sm font-medium text-foreground">{user?.name}</span>
          <button
            onClick={logout}
            aria-label="Keluar"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <TopNav onMenuClick={() => setSidebarOpen(true)} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
