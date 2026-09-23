import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Pass onClick to enable hover/active states automatically */
  onClick?: () => void;
}

/**
 * Base card surface.
 * Hover border (pointer:fine only) is handled via the
 * fine-pointer-hover CSS class in globals.css to avoid sticky
 * hover states on touch devices.
 */
export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={[
        'bg-card border border-border rounded-lg text-card-foreground',
        'transition-[border-color,box-shadow] duration-200',
        onClick ? 'w-full text-left cursor-pointer active:scale-[0.99] card-hover' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
};