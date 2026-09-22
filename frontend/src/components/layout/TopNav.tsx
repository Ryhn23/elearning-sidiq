import { Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface TopNavProps {
  onMenuClick: () => void;
}

/** Bar navigasi atas — hanya tampil di mobile (sidebar desktop sudah punya brand). */
export function TopNav({ onMenuClick }: TopNavProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
      <button onClick={onMenuClick} aria-label="Buka menu" className="text-muted-foreground hover:text-foreground">
        <Menu className="h-5 w-5" />
      </button>
      <span className="text-base font-bold text-foreground">E-Learning</span>
      <div className="ml-auto">
        <NotificationBell />
      </div>
    </header>
  );
}
