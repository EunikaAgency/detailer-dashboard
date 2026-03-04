import Link from "next/link";
import BetaBadge from "@/components/public-site/BetaBadge";
import PrimaryButton from "@/components/public-site/PrimaryButton";
import PublicNavigation from "@/components/public-site/PublicNavigation";
import QuickLinkCard from "@/components/public-site/QuickLinkCard";

export const metadata = {
  title: "Otsuka One Detailer",
  description: "Official internal portal for Otsuka One Detailer resources and Android distribution.",
};

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 3l7 3v6c0 5-3.5 8.7-7 10-3.5-1.3-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="18.2" r="1" fill="currentColor" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 19.5h16M7 16V9m5 7V5m5 11v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNavigation activeKey="home" />

      <section className="bg-gradient-to-br from-blue-50 via-white to-slate-50 py-14 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                <span className="text-sm font-medium text-blue-700">Internal Distribution Portal</span>
                <BetaBadge />
              </div>
              <h1 className="mb-4 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                Otsuka One Detailer
              </h1>
              <p className="mb-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                A secure internal platform for medical representatives and field detailers to
                download Android builds and access operational resources.
              </p>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton href="/download">Go to Download Page</PrimaryButton>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100"
                >
                  Admin Sign In
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
              <h2 className="mb-5 text-xl font-semibold text-slate-900">Portal Highlights</h2>
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Latest Android Build</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Centralized APK distribution from an official internal page.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Structured Installation Guide</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Clear steps for installation and troubleshooting on Android devices.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Connected Admin Dashboard</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Manage products, users, reports, and login monitoring in one system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold text-slate-900">Quick Access</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickLinkCard
            href="/download"
            title="Android Download"
            description="Get the latest APK release package."
            icon={<MobileIcon />}
          />
          <QuickLinkCard
            href="/dashboard"
            title="Dashboard"
            description="Open the admin portal for daily operations."
            icon={<ChartIcon />}
          />
          <QuickLinkCard
            href="/privacy-policy"
            title="Privacy Policy"
            description="Review platform data handling and policy details."
            icon={<ShieldIcon />}
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:px-6">
          <p className="font-semibold text-slate-800">Otsuka One Detailer</p>
          <p>Internal Beta Distribution System</p>
        </div>
      </footer>
    </div>
  );
}
