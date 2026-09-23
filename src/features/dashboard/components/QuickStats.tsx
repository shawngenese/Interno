import React from 'react';
import { Users, CheckSquare, Calendar, Star } from 'lucide-react';
import { StatsGrid, type StatItem } from '@/shared/components/ui/StatsGrid';

export const QuickStats: React.FC = () => {
  const stats: StatItem[] = [
    { label: 'Active Trainees',  value: '2,437', icon: <Users size={16} />,       color: 'primary' },
    { label: 'Completion Rate',  value: '94.2%', icon: <CheckSquare size={16} />, color: 'success' },
    { label: 'This Month',       value: '128',   icon: <Calendar size={16} />,    color: 'accent' },
    { label: 'Avg. GPA',         value: '3.2',   icon: <Star size={16} />,        color: 'warning' },
  ];

  return (
    <section className="py-8 lg:py-12 bg-card border border-border rounded-lg">
      <h3 className="text-[length:--text-heading] font-semibold text-foreground text-center mb-6">
        Quick Overview
      </h3>
      <div className="px-4">
        <StatsGrid stats={stats} />
      </div>
    </section>
  );
};