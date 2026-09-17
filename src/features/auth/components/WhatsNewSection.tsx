import React from "react"
import { Title } from "@/shared/components/ui/Title"
import { Grid } from "@/shared/components/ui/Grid"

export const WhatsNewSection: React.FC = () => {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <Title level={1} className="mb-6">
        What's New in Interno
      </Title>
      <Grid columns="2" gap={8} className="max-w-2xl">
        <div>
          <p className="text-textSecondary text-lg leading-relaxed">
            Version 2.0 introduces a completely redesigned UI inspired by
            Apple's design system, offering smoother navigation and better
            accessibility for coordinators and supervisors.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M13 2L3 14h9l-1 8 12-4v4h2V8h-4v4h2V4Z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-textPrimary">Seamless QR Scanning</p>
            <p className="text-textSecondary text-sm">Fast and reliable attendance tracking</p>
          </div>
        </div>
      </Grid>
    </section>
  )
}