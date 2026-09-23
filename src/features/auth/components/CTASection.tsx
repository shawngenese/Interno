import React from "react"
import { Button } from "@/shared/components/ui/Button"

export const CTASection: React.FC = () => {
  return (
    <section className="py-16 lg:py-24 bg-[var(--primary)] text-[var(--textInverse)]">
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-lg opacity-90 mb-6">
          Ready to transform your trainee management experience?
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="mx-auto"
          onClick={() => window.location.href="/login"}
        >
          Get Started
        </Button>
      </div>
    </section>
  )
}