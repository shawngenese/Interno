import { useAuth } from '@/features/auth';
import { useNavigate } from 'react-router-dom';
import { QrCode, CheckSquare, Clock, FileText, Building2, UserCheck, Calendar, Bell, Star } from 'lucide-react';

export function TraineeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Attendance',
      description: 'Scan QR code and view attendance history',
      route: '/trainee/attendance',
      icon: <QrCode className="h-5 w-5 text-primary" />,
      badge: 'QR Punch',
    },
    {
      title: 'My Tasks',
      description: 'View assigned tasks and submit deliverables',
      route: '/trainee/tasks',
      icon: <CheckSquare className="h-5 w-5 text-success" />,
      badge: 'Tasks',
    },
    {
      title: 'Daily Time Record',
      description: 'Review calculated hours, OT, and corrections',
      route: '/trainee/dtr',
      icon: <Clock className="h-5 w-5 text-warning" />,
      badge: 'DTR',
    },
    {
      title: 'Documents',
      description: 'Upload onboarding requirements and certs',
      route: '/trainee/documents',
      icon: <FileText className="h-5 w-5 text-primary" />,
      badge: 'Files',
    },
    {
      title: 'Leave',
      description: 'Request time off and track approvals',
      route: '/trainee/leave',
      icon: <Calendar className="h-5 w-5 text-info" />,
      badge: 'Time Off',
    },
    {
      title: 'Announcements',
      description: 'Read updates from your coordinators',
      route: '/trainee/announcements',
      icon: <Bell className="h-5 w-5 text-primary" />,
      badge: 'News',
    },
    {
      title: 'Evaluations',
      description: 'View supervisor feedback and ratings',
      route: '/trainee/evaluations',
      icon: <Star className="h-5 w-5 text-warning" />,
      badge: 'Reviews',
    },
    {
      title: 'Browse Companies',
      description: 'Explore verified host companies',
      route: '/trainee/companies',
      icon: <Building2 className="h-5 w-5 text-accent" />,
      badge: 'Directory',
    },
    {
      title: 'My Placement',
      description: 'Check external placement request status',
      route: '/trainee/placement',
      icon: <UserCheck className="h-5 w-5 text-primary" />,
      badge: 'Status',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Monitor your OJT attendance, daily logs, and requirements in real time.
        </p>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold text-foreground">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <button
              key={card.title}
              onClick={() => navigate(card.route)}
              className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
            >
              <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-foreground text-sm">{card.title}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                    {card.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
