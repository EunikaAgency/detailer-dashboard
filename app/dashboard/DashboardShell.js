"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const normalizeText = (value) => String(value || "").trim();

const getDisplayIdentity = (user) => {
  if (!user) return "Unknown user";
  return normalizeText(user.name || user.email || user.username || user.repId) || "Unknown user";
};

const getDisplayMeta = (user) => {
  if (!user) return "";
  return (
    normalizeText(user.email || user.username || user.repId) ||
    normalizeText(user.role) ||
    ""
  );
};

const getDisplayAccess = (user) =>
  normalizeText(user?.accessType).toLowerCase() === "admin" ? "Admin" : "Representative";

const AuthIndicator = ({ user, loading, onLogout, compact = false }) => {
  const baseClass = compact
    ? "rounded-xl border border-gray-200 bg-gray-50 px-3 py-3"
    : "flex max-w-[16rem] items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm";

  return (
    <div className={baseClass}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5" aria-hidden="true">
          <path d="M20 21a8 8 0 10-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green-600">
          {loading ? "Checking session" : "Logged in"}
        </div>
        <div className="truncate text-xs font-semibold text-gray-900">
          {loading ? "Loading account..." : getDisplayIdentity(user)}
        </div>
        <div className="truncate text-[11px] text-gray-500">
          {loading ? "" : [getDisplayMeta(user), getDisplayAccess(user)].filter(Boolean).join(" • ")}
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Logout"
        title="Logout"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4.5 w-4.5" aria-hidden="true">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </button>
    </div>
  );
};

export default function DashboardShell({ children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const pathname = usePathname();
  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/products", label: "Products" },
    { href: "/dashboard/users", label: "Users" },
    { href: "/dashboard/logins", label: "Logins" },
    { href: "/dashboard/reports", label: "Reports" },
    { href: "/dashboard/settings", label: "Settings" },
  ];

  const isRouteActive = (href) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  const linkClass = (href) =>
    `block px-3 py-2 rounded-lg font-medium ${
      isRouteActive(href)
        ? "bg-blue-50 text-blue-700"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/dashboard")) return;
    try {
      const search = typeof window !== "undefined" ? window.location.search || "" : "";
      window.localStorage.setItem("last_dashboard_path", `${pathname}${search}`);
    } catch {
      // Ignore storage failures (private mode, browser policies, etc.)
    }
  }, [pathname]);

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      setIsCheckingUser(true);
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!active) return;

        if (!response.ok) {
          setCurrentUser(null);
          return;
        }

        setCurrentUser(data?.user || null);
      } catch {
        if (!active) return;
        setCurrentUser(null);
      } finally {
        if (active) setIsCheckingUser(false);
      }
    };

    loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-gray-900/30 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          ></div>
          <nav className="relative z-50 w-64 bg-white h-full shadow-xl flex flex-col p-6 gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Menu</h2>
              <button
                className="h-9 w-9 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="flex flex-col gap-4">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    replace
                    scroll={false}
                    className={linkClass(item.href)}
                    onClick={(event) => {
                      if (isRouteActive(item.href)) {
                        event.preventDefault();
                      }
                      setSidebarOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <AuthIndicator user={currentUser} loading={isCheckingUser} onLogout={handleLogout} compact />
            </div>
          </nav>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Otsuka Admin Dashboard</h1>
        </div>
        <AuthIndicator user={currentUser} loading={isCheckingUser} onLogout={handleLogout} />
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-6 py-8">
        {children}
      </main>
    </div>
  );
}
