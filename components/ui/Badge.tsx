import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'red' | 'gray';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  className = ''
}) => {
  const variantStyles = {
    primary: 'bg-primary text-white',
    outline: 'border border-primary text-primary bg-white',
    red: 'bg-red-500 text-white',
    gray: 'bg-gray-100 text-gray-700'
  };

  return (
    <span
      className={`inline-block px-3 py-1 text-xs rounded ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
