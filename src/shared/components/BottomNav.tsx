import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth';

interface BottomNavItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactNode;
}

const items: BottomNavItem[] = [
  { label: 'Attendance', href: '/trainee/attendance', icon: AttendanceIcon },
  { label: 'Tasks', href: '/trainee/tasks', icon: TasksIcon },
  { label: 'DTR', href: '/trainee/dtr', icon: DTRIcon },
  { label: 'Documents', href: '/trainee/documents', icon: DocumentsIcon },
  { label: 'Announcements', href: '/trainee/announcements', icon: BellIcon },
  { label: 'Companies', href: '/trainee/companies', icon: CompaniesIcon },
];

export const BottomNav = React.memo(function BottomNav() {
  const { role } = useAuth();

  if (role !== 'trainee') return null;

  return (
    <nav aria-label="Main navigation (mobile)" className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-[#1E1E1E] border-t border-[#D5D5D5] dark:border-[#3A3A3A] safe-area-inset-bottom lg:hidden">
      <div className="flex justify-around items-center h-16">
        {items.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end
            aria-label={item.label}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 min-w-[56px] py-1 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-[#757575] dark:text-[#9E9E9E]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-6 h-6 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-hidden="true" />
                <span className="text-xs font-medium" aria-current={isActive ? 'page' : undefined}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
});

function AttendanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DTRIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function DocumentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function CompaniesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}
