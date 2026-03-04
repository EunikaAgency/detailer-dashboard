import Link from "next/link";

const NAV_ITEMS = [
  { key: "home", label: "Home", href: "/" },
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "download", label: "Download", href: "/download" },
];

export default function PublicNavigation({ activeKey }) {
  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-wide text-slate-900 sm:text-base">
          Otsuka One Detailer
        </Link>

        <div className="hidden items-center gap-5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`border-b-2 pb-1 text-sm transition-colors ${
                  active
                    ? "border-blue-600 font-semibold text-blue-700"
                    : "border-transparent text-slate-600 hover:text-blue-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 sm:text-sm"
        >
          Sign In
        </Link>
      </div>
      <div className="overflow-x-auto border-t border-slate-100 px-4 pb-2 pt-2 md:hidden">
        <div className="flex min-w-max items-center gap-4">
          {NAV_ITEMS.map((item) => {
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`text-sm whitespace-nowrap ${
                  active ? "font-semibold text-blue-700" : "text-slate-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
