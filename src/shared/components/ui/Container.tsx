import React from "react"

export const Container: React.FC<{children: React.ReactNode; className?: string}> = ({
  children,
  className,
}) => {
  return (
    <div
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className || ""}`}
    >
      {children}
    </div>
  )
}