import React from "react"
import { Title } from "@/shared/components/ui/Title"

export const TraineeList: React.FC = () => {
  const trainees = [
    {
      id: "1",
      name: "John Doe",
      company: "Tech Corp",
      role: "External Supervisor",
      status: "Active",
      progress: 89,
    },
    {
      id: "2",
      name: "Jane Smith",
      company: "Design Studio",
      role: "Internal Supervisor",
      status: "Active",
      progress: 76,
    },
    {
      id: "3",
      name: "Mike Johnson",
      company: "Innovate Labs",
      role: "External Supervisor",
      status: "Pending",
      progress: 45,
    },
  ]

  return (
    <section className="py-8 lg:py-12">
      <Title level={3} className="mb-6 text-center">
        Assigned Trainees
      </Title>
      <div className="bg-card rounded-2xl overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th className="relative py-3 pl-4 pr-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Trainee
              </th>
              <th className="relative py-3 pl-3 pr-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Company
              </th>
              <th className="relative py-3 pl-3 pr-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Role
              </th>
              <th className="relative py-3 pl-3 pr-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Progress
              </th>
              <th className="relative py-3 pl-3 pr-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((trainee) => (
              <tr key={trainee.id} className="hover:bg-muted/60">
                <td className="py-4 pl-4 pr-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-sm text-white font-bold">
                        {trainee.name.split(" ")[0][0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-foreground font-medium">{trainee.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {trainee.company}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 pl-3 pr-3">
                  <p className="text-muted-foreground text-sm">{trainee.company}</p>
                </td>
                <td className="py-4 pl-3 pr-3">
                  <p className="text-muted-foreground text-sm">{trainee.role}</p>
                </td>
                <td className="py-4 pl-3 pr-3">
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${trainee.progress > 50 ? "bg-primary" : "bg-success"}`}
                      style={{ width: `${trainee.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-muted-foreground text-sm ml-2">{trainee.progress}%</p>
                </td>
                <td className="py-4 pl-3 pr-3">
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
                      trainee.status === "Active"
                        ? "bg-success text-white"
                        : "bg-warning text-foreground"
                    }`}
                  >
                    {trainee.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}