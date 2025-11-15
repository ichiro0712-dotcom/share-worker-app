import React from 'react';

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({ children, className = '' }) => {
  return (
    <span
      className={`inline-block px-3 py-1 text-xs rounded bg-primary-light text-gray-700 ${className}`}
    >
      {children}
    </span>
  );
};
