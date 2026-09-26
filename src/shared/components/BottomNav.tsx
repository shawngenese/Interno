import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import {
  LayoutDashboard,
  GraduationCap,
  Building2,
  Calendar,
  ClipboardList,
  QrCode,
  Clock,
  FileText,
  CheckCircle,
  Handshake,
  Bell,
  Timer,
  FolderOpen,
  Star,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const traineeItems: BottomNavItem[] = [
  { label: 'Attendance',    href: '/trainee/attendance',    icon: Clock },
  { label: 'Tasks',         href: '/trainee/tasks',         icon: CheckCircle },
  { label: 'DTR',           href: '/trainee/dtr',           icon: Timer },
  { label: 'Documents',     href: '/trainee/documents',     icon: FolderOpen },
  { label: 'Evaluations',   href: '/trainee/evaluations',   icon: Star },
  { label: 'Announcements', href: '/trainee/announcements', icon: Bell },
];

const adminItems: BottomNavItem[] = [
  { label: 'Dashboard',   href: '/admin',                icon: LayoutDashboard },
  { label: 'Trainees',    href: '/admin/trainees',       icon: GraduationCap },
  { label: 'Companies',   href: '/admin/companies',      icon: Building2 },
  { label: 'Schedules',    href: '/admin/work-schedules', icon: Calendar },
  { label: 'Reports',      href: '/admin/reports',        icon: BarChart3 },
  { label: 'Audit Logs',   href: '/admin/audit-logs',     icon: ClipboardList },
];

const supervisorItems: BottomNavItem[] = [
  { label: 'Dashboard', href: '/supervisor',            icon: LayoutDashboard },
  { label: 'Trainees',  href: '/supervisor/trainees',   icon: GraduationCap },
  { label: 'QR',        href: '/supervisor/qr',         icon: QrCode },
  { label: 'DTR',       href: '/supervisor/dtr',        icon: FileText },
  { label: 'Tasks',     href: '/supervisor/tasks',      icon: CheckCircle },
];

const coordinatorItems: BottomNavItem[] = [
  { label: 'Dashboard',     href: '/coordinator',               icon: LayoutDashboard },
  { label: 'Trainees',      href: '/coordinator/trainees',      icon: GraduationCap },
  { label: 'Placements',    href: '/coordinator/placements',    icon: Handshake },
  { label: 'Documents',     href: '/coordinator/documents',     icon: FileText },
  { label: 'Announcements', href: '/coordinator/announcements', icon: Bell },
];

export const BottomNav = React.memo(function BottomNav({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  const { role } = useAuth();

  const items = role === 'admin'
    ? adminItems
    : role === 'supervisor'
    ? supervisorItems
    : role === 'coordinator'
    ? coordinatorItems
    : role === 'trainee'
    ? traineeItems
    : [];

  // Floating dock nav (macOS-style): frosted pill, tooltips, active dot.
  // No magnification — icons stay fixed.
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed bottom-[calc(0.875rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 ${alwaysVisible ? '' : 'lg:hidden'}`}
    >
      <div className="no-scrollbar flex items-end gap-0.5 overflow-x-auto rounded-[26px] border border-border bg-card/70 px-2 py-1.5 shadow-lg backdrop-blur-xl backdrop-saturate-150">
        {items.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/admin' || item.href === '/supervisor' || item.href === '/coordinator'}
            aria-label={item.label}
            data-label={item.label}
            className={({ isActive }) =>
              [
                'dock-item relative flex min-h-[52px] min-w-[52px] flex-col items-center justify-end gap-[3px]',
                'rounded-[18px] px-0.5 pb-1.5 pt-1',
                'text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:bg-muted/60',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-hidden="true"
                />
                <span
                  className="text-[10px] leading-none"
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
});
