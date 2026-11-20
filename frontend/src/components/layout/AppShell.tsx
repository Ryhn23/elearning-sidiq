import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Kerangka tata letak terpadu (AppShell) selaras dengan SIDIQ ERP:
 * - Desktop Sidebar Collapsible (w-20 / w-64)
 * - Mobile Slide-in Drawer
 * - Integrated Header (h-16) dengan ⌘K Quick Search, Dark Mode, & Avatar Dropdown
 * - Dynamic Main Area Padding
 */
export function AppShell({ children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('elearning_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('elearning_sidebar_collapsed', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Tutup drawer mobile saat resize ke desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Sidebar (Desktop Collapsible & Mobile Drawer) */}
      <Sidebar
        isCollapsed={isCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Wrapper that shifts dynamically with sidebar width */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300 ease-in-out bg-muted/20',
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64',
        )}
      >
        {/* Sticky Header h-16 */}
        <Header
          isSidebarCollapsed={isCollapsed}
          toggleSidebar={toggleSidebar}
          openMobileSidebar={() => setMobileOpen(true)}
        />

        {/* Page Content Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
