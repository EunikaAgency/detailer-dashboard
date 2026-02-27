"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardShell({ children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/");
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
          </nav>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className="text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Otsuka Admin Dashboard</h1>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
        >
          Logout
        </button>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-6 py-8">
        {children}
      </main>
    </div>
  );
}
