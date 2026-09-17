import React from "react"
import { clsx } from "@/shared/lib/clsx"

export const Grid: React.FC<{
  children: React.ReactNode
  className?: string
  columns?: "1" | "2" | "3"
  gap?: string | number
}> = ({
  children,
  className,
  columns = "1",
  gap = "gap-6",
}) => {
  const columnClasses = {
    "1": "grid-cols-1",
    "2": "grid-cols-2",
    "3": "grid-cols-3",
  }

  // Determine gap class based on prop
  const gapClass = typeof gap === 'number' ? `gap-${gap}` : gap;
  return (
    <div
      className={clsx(
        gapClass,
        columnClasses[columns],
        "sm:grid-cols-sm",
        "lg:grid-cols-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}