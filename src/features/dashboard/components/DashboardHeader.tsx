import React from "react"
import { Title } from "@/shared/components/ui/Title"
import { Button } from "@/shared/components/ui/Button"

export const DashboardHeader: React.FC = () => {
  return (
    <section className="py-8 lg:py-12 border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto">
        <Title level={2} className="mb-4">
          Dashboard
        </Title>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href="/trainees"}
        >
          Trainees
        </Button>
      </div>
    </section>
  )
}