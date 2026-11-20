import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

/**
 * Standard Page Header matching SIDIQ ERP design pattern:
 * - Title with Primary Icon
 * - Subtitle / description
 * - Right-aligned action buttons (wrap on mobile)
 * - Subtle bottom divider border-b border-border/50
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-2 pb-4 border-b border-border/50', className)}>
      {breadcrumbs && <div className="text-xs text-muted-foreground">{breadcrumbs}</div>}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="h-6 w-6 text-primary shrink-0" />}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-start sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
