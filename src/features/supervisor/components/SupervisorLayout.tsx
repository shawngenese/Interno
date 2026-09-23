import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { LogoutButton } from '@/features/auth';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { BottomNav } from '@/shared/components/BottomNav';
import {
  LayoutDashboard,
  GraduationCap,
  CheckCircle,
  QrCode,
  Clock,
  FileText,
  Calendar,
  ClipboardCheck,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/supervisor', icon: LayoutDashboard },
  { name: 'Trainees', href: '/supervisor/trainees', icon: GraduationCap },
  { name: 'Tasks', href: '/supervisor/tasks', icon: CheckCircle },
  { name: 'QR Code', href: '/supervisor/qr', icon: QrCode },
  { name: 'Attendance', href: '/supervisor/attendance', icon: Clock },
  { name: 'DTR Approvals', href: '/supervisor/dtr', icon: FileText },
  { name: 'Leave Requests', href: '/supervisor/leave', icon: Calendar },
  { name: 'Evaluations', href: '/supervisor/evaluations', icon: ClipboardCheck },
  { name: 'Announcements', href: '/supervisor/announcements', icon: Bell },
];

export function SupervisorLayout({ children }: { children: ReactNode }) {
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
      ?.name || 'Supervisor';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Mobile Top Header */}
      <header className="h-14 bg-card border-b border-border sticky top-0 z-40 flex items-center justify-between px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <img src="/interno-logo.jpg" alt="Interno logo" className="w-8 h-8 rounded-lg bg-white object-contain shadow-sm shrink-0" />
          <h1 className="text-base font-bold text-foreground">Interno Supervisor</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside
        aria-label="Supervisor navigation"
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
                Interno Supervisor
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
                end={item.href === '/supervisor'}
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
        className={`flex-1 flex flex-col transition-[margin-left] duration-200 ease-out ${
          isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex h-16 bg-card border-b border-border sticky top-0 z-20 items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            {currentPageTitle}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
              Supervisor
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
