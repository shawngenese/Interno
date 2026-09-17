import React from "react"
import { Container } from "@/shared/components/ui/Container"
import { FeaturesGrid } from "@/features/auth/components/FeaturesGrid"
import { StatsSection } from "@/features/auth/components/StatsSection"
import { WhatsNewSection } from "@/features/auth/components/WhatsNewSection"
import { CTASection } from "@/features/auth/components/CTASection"

export const LandingPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-background text-textPrimary">
      <Container>
        <WhatsNewSection />
        <StatsSection />
        <FeaturesGrid />
        <CTASection />
      </Container>
    </main>
  )
}