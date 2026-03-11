import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  id?: string;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, id, className = "", onClick }: CardProps) {
  const baseClasses = "bg-white rounded-xl shadow-sm border border-slate-200";
  const interactiveClasses = onClick ? "cursor-pointer hover:shadow-md transition-shadow" : "";
  
  return (
    <div 
      id={id}
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
