
import React from 'react';

interface TagProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({ children, color = 'bg-secondary text-secondary-foreground', className }) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color} ${className}`}
    >
      {children}
    </span>
  );
};
