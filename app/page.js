import Link from "next/link";
import Image from "next/image";
import { requireAuth } from "@/lib/auth";

export const metadata = {
  title: "Otsuka One Detailer",
  description:
    "A presentation workspace for browsing organized slides, materials, and reference content.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await requireAuth();
  const isSignedIn = !auth?.error;
  const authHref = isSignedIn ? "/dashboard" : "/login";
  const authLabel = isSignedIn ? "Dashboard" : "Sign In";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-sky-50 to-white pb-24 pt-6">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-lg font-bold text-white">
                D
              </div>
              <span className="text-lg font-semibold text-slate-900">Otsuka One Detailer</span>
            </Link>
            <div className="hidden items-center gap-6 text-sm md:flex">
              <Link href="/" className="font-semibold text-slate-900">
                Home
              </Link>
              <Link href="/dashboard" className="text-slate-600 transition-colors hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/download" className="text-slate-600 transition-colors hover:text-slate-900">
                Download
              </Link>
            </div>
          </div>
          <Link
            href={authHref}
            className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
          >
            {authLabel}
          </Link>
        </nav>

        <div className="mx-auto mt-14 w-full max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-7 inline-flex rounded-full border border-sky-200 bg-sky-100 px-4 py-2 text-sm font-medium text-sky-700">
              Presentation Workspace - BETA
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Organize and Present
              <br />
              <span className="bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
                Visual Materials
              </span>
              <br />
              with Clarity
            </h1>
            <p className="mx-auto mb-10 max-w-3xl text-base leading-7 text-slate-600 sm:text-xl">
              Browse presentation slides and reference materials in a structured interface designed
              for clear viewing and navigation.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-7 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-sky-600 hover:shadow-xl"
              >
                Open Presentation Library
              </Link>
              <Link
                href={authHref}
                className="inline-flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-7 py-4 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:border-slate-300 hover:shadow-xl"
              >
                {authLabel}
              </Link>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute left-8 top-24 h-64 w-64 rounded-full bg-sky-200 opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-12 right-8 h-72 w-72 rounded-full bg-blue-200 opacity-40 blur-3xl" />
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="relative">
            <div className="absolute inset-0 -rotate-1 rounded-3xl bg-gradient-to-r from-sky-100 to-blue-100" />
            <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
              <div className="mx-auto max-w-3xl">
                <Image
                  src="/uploads/homepage-ios-app-showcase.png"
                  alt="One Detailer app showcase"
                  width={1536}
                  height={2048}
                  className="h-auto w-full rounded-2xl border border-slate-200 shadow-xl"
                />
              </div>
              <p className="mt-8 text-center text-base font-medium text-slate-600 sm:text-lg">
                A clear workspace for viewing presentation slides and organized content.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-white to-sky-50 py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl">Core Features</h2>
          </div>
          <div className="mb-20 grid grid-cols-1 gap-6 md:grid-cols-3">
            <article className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-xl font-bold text-white transition-transform duration-300 group-hover:scale-110">
                01
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Organized Presentation Library</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Browse visual slides and presentation materials in a structured gallery.
              </p>
            </article>
            <article className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-500 text-xl font-bold text-white transition-transform duration-300 group-hover:scale-110">
                02
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Clear Slide Viewing</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Display presentation materials in a clean layout designed for easy navigation.
              </p>
            </article>
            <article className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 text-xl font-bold text-white transition-transform duration-300 group-hover:scale-110">
                03
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Quick Access to Resources</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Locate reference materials and presentation content quickly.
              </p>
            </article>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-blue-600 p-8 text-center text-white shadow-2xl sm:p-14">
            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-rose-700 opacity-35 blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold sm:text-5xl">Designed for Clear Communication</h2>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-sky-100 sm:text-xl">
                The platform focuses on organizing visual materials and presentation slides in a
                simple environment that makes information easy to access and display.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 py-16 text-white">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-lg font-bold text-white">
                  D
                </div>
                <span className="text-xl font-semibold">Otsuka One Detailer</span>
              </div>
              <p className="max-w-md text-sm leading-7 text-slate-300">
                Presentation materials and reference content are provided for informational purposes.
              </p>
            </div>
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">Quick Links</h3>
              <div className="space-y-3">
                <Link
                  href="/download"
                  className="group flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 transition-all hover:border-sky-500/60 hover:bg-slate-800"
                >
                  <span className="font-medium text-white">Download</span>
                  <span className="text-xs text-slate-400 transition-colors group-hover:text-sky-400">
                    https://otsukadetailer.site/download
                  </span>
                </Link>
                <Link
                  href="/dashboard"
                  className="group flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 transition-all hover:border-sky-500/60 hover:bg-slate-800"
                >
                  <span className="font-medium text-white">Dashboard</span>
                  <span className="text-xs text-slate-400 transition-colors group-hover:text-sky-400">
                    https://otsukadetailer.site/dashboard
                  </span>
                </Link>
                <Link
                  href="/privacy-policy"
                  className="group flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 transition-all hover:border-sky-500/60 hover:bg-slate-800"
                >
                  <span className="font-medium text-white">Privacy Policy</span>
                  <span className="text-xs text-slate-400 transition-colors group-hover:text-sky-400">
                    https://otsukadetailer.site/privacy-policy
                  </span>
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-center text-sm text-slate-400">
            © 2026 One Detailer. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
