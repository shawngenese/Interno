import React from "react"

export const Card: React.FC<{children: React.ReactNode; className?: string}> = ({
  children,
  className,
}) => {
  return (
    <div
      className={`rounded-2xl bg-white p-6 shadow-sm ${className || ""}`}
    >
      {children}
    </div>
  )
}