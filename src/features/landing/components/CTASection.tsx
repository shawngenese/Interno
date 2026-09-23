import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { ArrowRight, Sparkles } from 'lucide-react';

export const CTASection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-primary text-primary-foreground p-8 sm:p-12 lg:p-16 text-center relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready for Modern OJT Management?</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Start Monitoring Trainees with Total Confidence
            </h2>

            <p className="text-sm sm:text-base text-primary-foreground/80 leading-relaxed">
              Experience QR attendance, automated compliance, and real-time evaluation today.
            </p>

            <div className="pt-2">
              <Link to="/login">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white text-primary hover:bg-white/90 border-transparent font-bold"
                >
                  Access Your Account
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
