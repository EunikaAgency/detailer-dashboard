import { ReactNode } from "react";

interface PillProps {
  children: ReactNode;
  id?: string;
  variant?: "default" | "success" | "warning" | "muted";
  className?: string;
}

export function Pill({ children, id, variant = "default", className = "" }: PillProps) {
  const variants = {
    default: "bg-blue-100 text-blue-700 border-blue-200",
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    muted: "bg-slate-100 text-slate-600 border-slate-200"
  };
  
  return (
    <span id={id} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
