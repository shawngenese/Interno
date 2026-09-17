import React from "react"

export const NavBar: React.FC = () => {
  return (
    <header className="bg-white border-b border-[var(--border)] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-[var(--labelPrimary)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M13 2L3 14h9l-1 8 12-4v4h2V8h-4v4h2V4Z" />
            </svg>
            <span className="text-xl font-bold">Interno</span>
          </div>
          <div className="flex items-center gap-4">
            <svg
              className="w-5 h-5 text-[var(--labelSecondary)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M13 2L3 14h9l-1 8 12-4v4h2V8h-4v4h2V4Z" />
            </svg>
            <span className="text-sm text-[var(--labelSecondary)]">Admin</span>
          </div>
        </div>
      </div>
    </header>
  )
}