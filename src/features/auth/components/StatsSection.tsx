import React from "react"
import { Title } from "@/shared/components/ui/Title"
import { StatsGrid } from "@/shared/components/ui/StatsGrid"

export const StatsSection: React.FC = () => {
  const stats = [
    { label: "Trainees", value: "2,437", icon: "User" },
    { label: "Companies", value: "89", icon: "Building" },
    { label: "Tasks", value: "12,845", icon: "CheckSquare" },
    { label: "Attendance", value: "94.2%", icon: "Clock" },
  ]

  return (
    <section className="py-16 lg:py-24 bg-[var(--surface)]">
      <Title level={1} className="mb-8 text-center">
        Track Progress at a Glance
      </Title>
      <StatsGrid stats={stats} />
    </section>
  )
}