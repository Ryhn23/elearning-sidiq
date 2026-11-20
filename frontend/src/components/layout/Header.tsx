import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Moon,
  Sun,
  User,
  Search,
  LogOut,
  ExternalLink,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from './ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { NotificationBell } from './NotificationBell';
import { cn } from '@/lib/utils';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  toggleSidebar: () => void;
  openMobileSidebar: () => void;
}

export function Header({
  toggleSidebar,
  openMobileSidebar,
}: HeaderProps) {
  const { setTheme, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/courses?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const roleLabel =
    user?.role === 'admin'
      ? 'Administrator'
      : user?.role === 'teacher'
        ? 'Guru / Ustadz'
        : 'Santri';

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 transition-all duration-300',
      )}
    >
      {/* Left Area: Toggle & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Toggle on desktop (collapses sidebar), on mobile opens drawer */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (window.innerWidth < 1024) {
              openMobileSidebar();
            } else {
              toggleSidebar();
            }
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Global Search Bar (with ⌘K shortcut badge) */}
        <form onSubmit={handleSearchSubmit} className="hidden sm:flex relative w-full max-w-md group">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kursus, materi, kuis..."
            className="h-10 w-full rounded-lg border border-border bg-muted/40 pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-2.5 hidden h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </form>
      </div>

      {/* Right Area: Actions, Theme, Notifications & User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <NotificationBell />

        {/* Theme Toggle Button (Light/Dark) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
          title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-700" />}
        </Button>

        {/* User Avatar Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-offset-background transition-transform hover:scale-105 hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="Menu Pengguna"
            >
              {userInitial}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none text-foreground">{user?.name ?? 'Pengguna'}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                <div className="pt-1">
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Profil Saya</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => navigate(user?.role === 'student' ? '/student/courses' : '/teacher/courses')}>
              <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Kursus Saya</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => navigate('/courses')}>
              <GraduationCap className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Katalog Kursus</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Link back to SIDIQ Portal */}
            <DropdownMenuItem
              onClick={() => {
                const sidiqUrl = import.meta.env.VITE_SIDIQ_URL || 'https://staging.sidiq.pages.dev';
                window.location.href = sidiqUrl;
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-300 font-medium">Kembali ke SIDIQ ERP</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Header;
