export default function InstructionStep({ number, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
        {number}
      </div>
      <p className="text-sm leading-6 text-slate-700 sm:text-base">{children}</p>
    </div>
  );
}
