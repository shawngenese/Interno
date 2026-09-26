import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, NavLink, Link } from 'react-router-dom';
import { LogoutButton } from '@/features/auth';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { BottomNav } from '@/shared/components/BottomNav';
import {
  LayoutDashboard,
  Users,
  Building2,
  Building,
  UserCheck,
  UserCog,
  GraduationCap,
  Calendar,
  Clock,
  ClipboardList,
  Bell,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Companies', href: '/admin/companies', icon: Building2 },
  { name: 'Departments', href: '/admin/departments', icon: Building },
  { name: 'Supervisors', href: '/admin/supervisors', icon: UserCheck },
  { name: 'Coordinators', href: '/admin/coordinators', icon: UserCog },
  { name: 'Trainees', href: '/admin/trainees', icon: GraduationCap },
  { name: 'Work Schedules', href: '/admin/work-schedules', icon: Calendar },
  { name: 'OJT Schedules', href: '/admin/ojt-schedules', icon: Clock },
  { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList },
  { name: 'Announcements', href: '/admin/announcements', icon: Bell },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('interno:sidebar') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('interno:sidebar', String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  };

  const currentPageTitle =
    [...navigation]
      .sort((a, b) => b.href.length - a.href.length)
      .find((n) => location.pathname === n.href || location.pathname.startsWith(n.href + '/'))
      ?.name || 'Admin';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Mobile Top Header */}
      <header className="h-14 bg-card border-b border-border sticky top-0 z-40 flex items-center justify-between px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <img src="/interno-logo.jpg" alt="Interno logo" className="w-8 h-8 rounded-lg bg-white object-contain shadow-sm shrink-0" />
          <h1 className="text-base font-bold text-foreground">Interno Admin</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/notifications"
            aria-label="Notifications"
            className="min-w-11 min-h-11 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-target flex items-center justify-center"
          >
            <Bell className="w-5 h-5" />
          </Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      {/* Desktop Sidebar (hidden on mobile < lg) */}
      <aside
        aria-label="Admin navigation"
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-card border-r border-border transition-[width] duration-200 ease-out z-30 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Sidebar Header */}
        <div className={`px-3 border-b border-border flex shrink-0 ${isCollapsed ? 'flex-col items-center gap-1 py-3' : 'h-16 items-center justify-between'}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="/interno-logo.jpg" alt="Interno logo" className="w-8 h-8 rounded-lg bg-white object-contain shadow-sm shrink-0" />
              <span className="font-bold text-base text-foreground tracking-tight truncate">
                Interno Admin
              </span>
            </div>
          ) : (
            <div>
              <img src="/interno-logo.jpg" alt="Interno logo" className="w-8 h-8 rounded-lg bg-white object-contain shadow-sm shrink-0" />
            </div>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            className="min-w-11 min-h-11 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-target flex items-center justify-center"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto no-scrollbar">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/admin'}
                title={isCollapsed ? item.name : undefined}
                aria-label={item.name}
                className={({ isActive }) =>
                  `flex items-center h-[44px] rounded-lg text-sm font-medium transition-colors ${
                    isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'
                  } ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`}
                      aria-hidden="true"
                    />
                    {!isCollapsed && (
                      <span className="truncate" aria-current={isActive ? 'page' : undefined}>
                        {item.name}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border flex flex-col gap-2 shrink-0">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
            <ThemeToggle />
            {!isCollapsed && <span className="text-xs text-muted-foreground">Theme</span>}
          </div>
          <div className={`pt-1 flex ${isCollapsed ? 'justify-center' : ''}`}>
            <LogoutButton iconOnly={isCollapsed} className={isCollapsed ? '' : 'w-full justify-center text-xs'} />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 transition-[padding-left] duration-200 ease-out pb-24 lg:pb-8 ${
          isCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        {/* Desktop Top Bar */}
        <header className="hidden lg:flex h-16 bg-card border-b border-border sticky top-0 z-20 items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            {currentPageTitle}
          </h2>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/notifications"
              aria-label="Notifications"
              className="min-w-11 min-h-11 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-target flex items-center justify-center"
            >
              <Bell className="w-5 h-5" />
            </Link>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
              Administrator
            </span>
          </div>
        </header>

        {/* Content */}
        <main
          id="main-content"
          className="p-4 md:p-6 min-h-[calc(100dvh-152px)] lg:min-h-[calc(100dvh-96px)]"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (< lg) */}
      <BottomNav />
    </div>
  );
}