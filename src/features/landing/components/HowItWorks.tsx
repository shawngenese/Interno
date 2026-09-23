import React from 'react';
import { UserPlus, QrCode, Calculator, Award } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Coordinator Creates Trainee',
      description: 'Assign initial internal or external supervisor and configure document checklists.',
      icon: <UserPlus className="w-5 h-5 text-primary" />,
    },
    {
      number: '02',
      title: 'Trainee Scans QR Code',
      description: 'Daily time in and time out validated using time-bound secure QR tokens.',
      icon: <QrCode className="w-5 h-5 text-primary" />,
    },
    {
      number: '03',
      title: 'Automated DTR Tracking',
      description: 'Cloud functions calculate regular hours, overtime, tardiness, and night differentials.',
      icon: <Calculator className="w-5 h-5 text-primary" />,
    },
    {
      number: '04',
      title: 'Evaluation & Completion',
      description: 'Supervisors submit monthly evaluations and generate final completion reports.',
      icon: <Award className="w-5 h-5 text-primary" />,
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-muted/20 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            How Interno Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            A frictionless 4-step workflow from onboarding to completion certificate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-2xl p-6 relative flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {step.icon}
                </div>
                <span className="text-2xl font-black text-muted-foreground/30">{step.number}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-1.5">{step.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
