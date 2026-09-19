import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogoutButton } from '@/features/auth';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
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
  { label: 'Companies', href: '/trainee/companies', icon: CompaniesIcon },
];

export const BottomNav = React.memo(function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { role } = useAuth();

  if (role !== 'trainee') return null;

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#121212]/80 lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && (
        <div className="fixed bottom-16 right-2 z-50 bg-white dark:bg-[#1E1E1E] border border-[#D5D5D5] dark:border-[#3A3A3A] rounded-xl shadow-lg p-3 min-w-[140px] lg:hidden">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm text-[#3A3A3A] dark:text-[#BDBDBD]">Theme</span>
            <ThemeToggle />
          </div>
          <div className="border-t border-[#D5D5D5] dark:border-[#3A3A3A] pt-2">
            <LogoutButton className="w-full justify-center" />
          </div>
        </div>
      )}

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
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[56px] py-1 ${
              moreOpen
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-[#757575] dark:text-[#9E9E9E]'
            }`}
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            <MoreIcon className="w-6 h-6" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
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

function LeaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
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
