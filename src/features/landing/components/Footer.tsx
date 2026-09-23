import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-card border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/interno-logo.jpg" alt="Interno logo" className="w-8 h-8 rounded-lg bg-white object-contain shadow-sm shrink-0" />
            <div>
              <span className="font-bold text-foreground text-sm">Interno</span>
              <p className="text-xs text-muted-foreground">Mobile-First OJT Management System</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a>
            <Link to="/login" className="hover:text-primary transition-colors">Sign In</Link>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Interno. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
