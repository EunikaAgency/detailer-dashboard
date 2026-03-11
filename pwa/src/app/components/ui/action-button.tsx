import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useAppSettings, type ActionLabels } from "../../lib/settings";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  mode?: ActionLabels;
  tone?: "light" | "dark";
  active?: boolean;
}

export function ActionButton({
  icon,
  label,
  mode,
  tone = "light",
  active = false,
  className = "",
  type = "button",
  title,
  ...props
}: ActionButtonProps) {
  const settings = useAppSettings();
  const presentation = mode ?? settings.actionLabels;
  const iconOnly = presentation === "icons";

  const toneClasses =
    tone === "dark"
      ? active
        ? "bg-blue-500 text-white"
        : "bg-slate-800/80 text-white hover:bg-slate-700"
      : active
        ? "bg-blue-50 text-blue-700 border border-blue-200"
        : "text-slate-700 hover:bg-slate-100";

  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses} ${iconOnly ? "min-w-10" : "min-w-10 px-3.5"} ${className}`}
      aria-label={props["aria-label"] ?? label}
      title={title ?? (iconOnly ? label : undefined)}
      {...props}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {icon}
      </span>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
