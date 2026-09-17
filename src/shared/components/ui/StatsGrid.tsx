import React from "react"

const iconMap: Record<string, string> = {
  User: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2ZM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Z",
  CheckSquare: "M19 9v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9h10m-3 0a2 2 0 0 0-2 2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
}

export const StatsGrid: React.FC<{stats: {label: string; value: string; icon: string}[]}> = ({
  stats,
}) => {
  return (
    <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d={iconMap[stat.icon]} />
            </svg>
          </div>
          <p className="font-medium text-textPrimary text-3xl tracking-tight">{stat.value}</p>
          <p className="text-textSecondary mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}