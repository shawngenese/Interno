import React from "react"
import { Container } from "@/shared/components/ui/Container"
import { NavBar } from "@/shared/components/ui/NavBar"
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader"
import { QuickStats } from "@/features/dashboard/components/QuickStats"
import { TraineeList } from "@/features/dashboard/components/TraineeList"

export const Dashboard: React.FC = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Container>
        <NavBar />
        <DashboardHeader />
        <QuickStats />
        <TraineeList />
      </Container>
    </main>
  )
}