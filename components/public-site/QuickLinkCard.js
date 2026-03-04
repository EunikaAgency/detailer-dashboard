import Link from "next/link";

export default function QuickLinkCard({ href, title, description, icon }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <p className="mt-3 text-xs font-semibold text-blue-700 group-hover:text-blue-800">Open</p>
    </Link>
  );
}
