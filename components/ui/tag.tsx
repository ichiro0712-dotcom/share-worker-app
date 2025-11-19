import React from 'react';

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

export function Tag({ children, className = '' }: TagProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
    >
      {children}
    </span>
  );
}
