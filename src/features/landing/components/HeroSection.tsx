import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Generation OJT Management</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight max-w-4xl mx-auto leading-tight">
          Streamlined OJT Tracking, Attendance & Compliance
        </h1>

        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Interno delivers tamper-proof QR attendance, automatic DTR calculation, real-time task tracking, and role-based workflows for trainees, supervisors, and coordinators.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
          <Link to="/login" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="primary"
              className="w-full sm:w-auto"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>

          <a href="#how-it-works" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              How It Works
            </Button>
          </a>
        </div>

        {/* Feature Highlights Banner */}
        <div className="mt-12 pt-8 border-t border-border max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Cryptographic QR Punch In/Out</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Automated DTR & OT Computation</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Zero-Trust Security & Audit Logs</span>
          </div>
        </div>
      </div>
    </section>
  );
};
