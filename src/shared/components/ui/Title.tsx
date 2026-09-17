import React from "react"

const tagMap: Record<number, keyof JSX.IntrinsicElements> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
}

export const Title: React.FC<{level?: 1 | 2 | 3 | 4 | 5 | 6; className?: string; children?: React.ReactNode}> = ({
  level = 1,
  className,
  children,
}) => {
  const styles = {
    1: "text-4xl lg:text-5xl font-bold tracking-tight",
    2: "text-3xl lg:text-4xl font-semibold tracking-tight",
    3: "text-2xl lg:text-3xl font-medium tracking-tight",
    4: "text-lg lg:text-xl font-medium",
    5: "text-base lg:text-xl font-medium",
    6: "text-sm font-medium",
  }

  const Tag = tagMap[level]
  return <Tag className={`${styles[level]} ${className || ""}`}>{children}</Tag>
}