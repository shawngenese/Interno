import React from 'react';
import { Card } from '@/shared/components/ui/Card';
import { QrCode, CheckSquare, Clock, FileText, Building2, ShieldCheck } from 'lucide-react';

export const FeaturesGrid: React.FC = () => {
  const features = [
    {
      title: 'QR Attendance System',
      description: 'One-time cryptographic tokens with expiration and offline verification to prevent buddy punching.',
      icon: <QrCode className="w-6 h-6 text-primary" />,
    },
    {
      title: 'Task Management',
      description: 'Assign, submit, and review daily tasks with status workflows, priority flags, and attachments.',
      icon: <CheckSquare className="w-6 h-6 text-primary" />,
    },
    {
      title: 'Automated DTR Records',
      description: 'Real-time computation of regular hours, overtime, tardiness, and night differential with zero math errors.',
      icon: <Clock className="w-6 h-6 text-primary" />,
    },
    {
      title: 'Document Compliance Hub',
      description: 'Centralized document checklists, medical certs, training agreements, and digital sign-offs.',
      icon: <FileText className="w-6 h-6 text-primary" />,
    },
    {
      title: 'Company & Placement Portal',
      description: 'Support internal assignments and external company requests with coordinator verification.',
      icon: <Building2 className="w-6 h-6 text-primary" />,
    },
    {
      title: 'Role-Based Security',
      description: 'Strict custom claims and security rules for Trainees, Internal/External Supervisors, and Coordinators.',
      icon: <ShieldCheck className="w-6 h-6 text-primary" />,
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Comprehensive Tools for Modern OJT Programs
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Everything your institution and partner companies need to monitor trainee progress seamlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 sm:p-8 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                {feature.icon}
              </div>
              <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
