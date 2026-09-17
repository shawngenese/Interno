import React from "react"
import { Title } from "@/shared/components/ui/Title"
import { StatsGrid } from "@/shared/components/ui/StatsGrid"

export const QuickStats: React.FC = () => {
  const stats = [
    { label: "Active Trainees", value: "2,437", icon: "User" },
    { label: "Completion Rate", value: "94.2%", icon: "CheckSquare" },
    { label: "This Month", value: "128", icon: "Calendar" },
    { label: "Avg. GPA", value: "3.2", icon: "Star" },
  ]

  return (
    <section className="py-8 lg:py-12 bg-[var(--surface)] rounded-2xl shadow-sm">
      <Title level={3} className="mb-6 text-center">
        Quick Overview
      </Title>
      <StatsGrid stats={stats} />
    </section>
  )
}