interface FilterChipProps {
  id?: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function FilterChip({ id, label, active, onClick }: FilterChipProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap ${
        active
          ? "bg-blue-500 text-white border-blue-500"
          : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
      }`}
    >
      {label}
    </button>
  );
}
