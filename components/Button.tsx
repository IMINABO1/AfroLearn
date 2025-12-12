import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  icon,
  className = '',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-6 py-4 text-base font-semibold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-200 focus:ring-brand-500 active:scale-95",
    secondary: "bg-accent-green text-white hover:bg-accent-darkGreen focus:ring-accent-green",
    outline: "border-2 border-brand-200 text-brand-800 hover:border-brand-600 hover:bg-brand-50 focus:ring-brand-500"
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      <span className="flex-1 text-center flex items-center justify-center gap-2">
        {children}
        {icon || (variant === 'primary' && <ArrowRight size={20} />)}
      </span>
    </button>
  );
};
