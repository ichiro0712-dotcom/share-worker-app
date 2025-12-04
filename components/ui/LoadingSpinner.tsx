interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray' | 'admin';
  variant?: 'worker' | 'admin';
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

const colorClasses = {
  primary: 'border-primary border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-300 border-t-gray-600',
  admin: 'border-admin-primary border-t-transparent',
};

export function LoadingSpinner({
  size = 'md',
  color,
  variant = 'worker',
  className = '',
}: LoadingSpinnerProps) {
  const effectiveColor = color || (variant === 'admin' ? 'admin' : 'primary');

  return (
    <div
      className={`rounded-full animate-spin ${sizeClasses[size]} ${colorClasses[effectiveColor]} ${className}`}
      role="status"
      aria-label="読み込み中"
    />
  );
}
