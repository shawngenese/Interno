import React from 'react';

type StatColor = 'primary' | 'success' | 'warning' | 'destructive' | 'accent' | 'info';

export interface StatItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: StatColor;
  trend?: { value: number; label: string };
}

interface StatsGridProps {
  stats: StatItem[];
  className?: string;
}

const colorClasses: Record<StatColor, string> = {
  primary:     'text-primary bg-primary/10',
  success:     'text-success bg-success/10',
  warning:     'text-warning bg-warning/10',
  destructive: 'text-destructive bg-destructive/10',
  accent:      'text-accent bg-accent/10',
  info:        'text-info bg-info/10',
};

export const StatsGrid = React.memo(function StatsGrid({ stats, className = '' }: StatsGridProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`}>
      {stats.map((stat, index) => {
        const colorClass = colorClasses[stat.color ?? 'primary'];

        return (
          <div
            key={index}
            className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2"
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${colorClass}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-(--text-display-sm) font-bold text-foreground leading-none">
                {stat.value}
              </p>
              <p className="text-(--text-body-sm) text-muted-foreground mt-0.5">
                {stat.label}
              </p>
            </div>
            {stat.trend && (
              <p className={`text-xs ${stat.trend.value >= 0 ? 'text-success' : 'text-destructive'}`}>
                {stat.trend.value >= 0 ? '+' : ''}{stat.trend.value}% {stat.trend.label}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
});