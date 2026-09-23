import React from 'react';
import { Users, Building2, CheckSquare, Clock } from 'lucide-react';
import { StatsGrid, type StatItem } from '@/shared/components/ui/StatsGrid';

export const StatsSection: React.FC = () => {
  const stats: StatItem[] = [
    { label: 'Trainees',   value: '2,437', icon: <Users size={16} />,       color: 'primary' },
    { label: 'Companies',  value: '89',    icon: <Building2 size={16} />,   color: 'accent' },
    { label: 'Tasks',      value: '12,845',icon: <CheckSquare size={16} />, color: 'success' },
    { label: 'Attendance', value: '94.2%', icon: <Clock size={16} />,       color: 'info' },
  ];

  return (
    <section className="py-16 lg:py-24 bg-background">
      <h2 className="text-[length:--text-display-sm] font-bold text-foreground text-center mb-8">
        Track Progress at a Glance
      </h2>
      <div className="max-w-4xl mx-auto px-4">
        <StatsGrid stats={stats} />
      </div>
    </section>
  );
};