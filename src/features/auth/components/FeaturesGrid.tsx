import React from "react"
import { Card } from "@/shared/components/ui/Card"
import { Title } from "@/shared/components/ui/Title"

const featureIcons = [
  "M12 2L15 5l-3 3L9.5 17.5L12 20l4.5-3.5L19.5 8L12 5Z",
  "M13 2L3 14h9l-1 8 12-4v4h2V8h-4v4h2V4Z",
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Z",
  "M9 18C9 13.73 13.73 9 18 9s9 4.73 9 9v-3.5c0-.83-.67-1.5-1.5-1.5H8c-.83 0-1.5.67-1.5 1.5V18ZM11 7h2v2h-2V7ZM13 7h2v2h-2V7Z",
]

export const FeaturesGrid: React.FC = () => {
  const features = [
    {
      title: "QR Attendance",
      description: "Scan QR codes to track trainee attendance in real-time with offline support.",
      icon: featureIcons[0],
    },
    {
      title: "Task Management",
      description: "Assign and monitor tasks with progress tracking and deadline management.",
      icon: featureIcons[1],
    },
    {
      title: "DTR Calculations",
      description: "Automated Daily Time Record calculations with intelligent break detection.",
      icon: featureIcons[2],
    },
    {
      title: "Document Hub",
      description: "Upload, share, and manage training documents and reports securely.",
      icon: featureIcons[3],
    },
  ]

  return (
    <section className="py-16 lg:py-24 bg-background">
      <Title level={1} className="mb-8 text-center">
        Features Built for Success
      </Title>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {features.map((feature, index) => (
          <Card key={index} className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-6 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-primary"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d={feature.icon} />
              </svg>
            </div>
            <h3 className="font-medium text-textPrimary mb-2">{feature.title}</h3>
            <p className="text-textSecondary leading-relaxed">
              {feature.description}
            </p>
          </Card>
        ))}
      </div>
    </section>
  )
}