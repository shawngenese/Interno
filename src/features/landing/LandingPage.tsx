import React from 'react';
import { Link } from 'react-router-dom';
import { HeroSection } from './components/HeroSection';
import { StatsSection } from './components/StatsSection';
import { FeaturesGrid } from './components/FeaturesGrid';
import { HowItWorks } from './components/HowItWorks';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Button } from '@/shared/components/ui/Button';
import { LogIn } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/interno-logo.jpg" alt="Interno logo" className="w-9 h-9 rounded-xl bg-white object-contain shadow-sm shrink-0" />
            <span className="text-lg font-bold text-foreground tracking-tight">Interno</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button size="sm" variant="primary">
                <LogIn className="w-4 h-4 mr-1.5" />
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Page Sections */}
      <main className="flex-1">
        <HeroSection />
        <StatsSection />
        <FeaturesGrid />
        <HowItWorks />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
};
