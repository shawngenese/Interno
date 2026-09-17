import React from "react"

export const Button: React.FC<{
  variant?: "primary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
  className?: string
  onClick?: () => void
  children?: React.ReactNode
}> = ({
  variant = "primary",
  size = "md",
  className,
  onClick,
  children,
}) => {
  const sizeStyles = {
    sm: "h-9 px-4 text-sm",
    md: "h-10 px-6 text-base",
    lg: "h-12 px-8 text-lg",
  }

  const variantStyles = {
    primary: "bg-primary text-white hover:bg-[var(--primaryHover)]",
    outline: "border-2 border-white text-white hover:bg-white hover:text-[var(--primary)]",
    ghost: "hover:bg-[var(--surfaceSecondary)]",
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
        sizeStyles[size]
      } ${variantStyles[variant]} ${className || ""}`}
    >
      {children}
    </button>
  )
}