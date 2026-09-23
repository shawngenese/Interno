import React from 'react';
import { Users, Building2, CheckSquare, Clock } from 'lucide-react';
import { StatsGrid, type StatItem } from '@/shared/components/ui/StatsGrid';

export const StatsSection: React.FC = () => {
  const stats: StatItem[] = [
    { label: 'Active Trainees', value: '2,400+', icon: <Users size={16} />, color: 'primary' },
    { label: 'Partner Companies', value: '120+', icon: <Building2 size={16} />, color: 'accent' },
    { label: 'Tasks Completed', value: '15,000+', icon: <CheckSquare size={16} />, color: 'success' },
    { label: 'On-Time Rate', value: '96.8%', icon: <Clock size={16} />, color: 'info' },
  ];

  return (
    <section className="py-12 sm:py-16 bg-card border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Trusted by Universities & Host Training Establishments
          </h2>
        </div>
        <div className="max-w-5xl mx-auto">
          <StatsGrid stats={stats} />
        </div>
      </div>
    </section>
  );
};
