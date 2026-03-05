import BetaBadge from "@/components/public-site/BetaBadge";
import PrimaryButton from "@/components/public-site/PrimaryButton";
import PublicNavigation from "@/components/public-site/PublicNavigation";
import QuickLinkCard from "@/components/public-site/QuickLinkCard";

export const metadata = {
  title: "Otsuka One Detailer - Android Download (Beta)",
  description: "Internal Android APK distribution portal for Otsuka One Detailer.",
};

function SmartphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="18.2" r="1" fill="currentColor" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10-2h8v10h-8V11z" fill="currentColor" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5 4.5A2.5 2.5 0 017.5 2H20v16H7.5A2.5 2.5 0 005 20.5V4.5zm0 0A2.5 2.5 0 017.5 7H20"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M15 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNavigation activeKey="download" />

      <section className="bg-gradient-to-br from-blue-50 to-white py-12 sm:py-16">
        <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6">
          <div className="mb-4 flex items-center justify-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Otsuka One Detailer</h1>
            <BetaBadge />
          </div>
          <p className="mb-3 text-lg text-slate-700">Internal Android Distribution Portal</p>
          <p className="mx-auto max-w-2xl text-slate-600">
            Otsuka One Detailer is used by medical representatives and field detailers to access
            presentation materials and tools while on duty.
          </p>
        </div>
      </section>

      <section className="mx-auto -mt-8 w-full max-w-4xl px-4 sm:px-6">
        <div className="rounded-xl bg-white p-6 shadow-lg sm:p-10">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
              <SmartphoneIcon />
            </div>
            <div className="flex-1">
              <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                Download Otsuka One Detailer (Android APK)
              </h2>
              <p className="text-slate-600">
                Use this page to download the latest internal testing build of the Otsuka One
                Detailer app for Android devices.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <PrimaryButton href="/_otsuka-detailer.apk" download>
              Download Latest APK
            </PrimaryButton>
          </div>

          <div className="space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="flex gap-2">
              <span className="text-slate-600">Version:</span>
              <span className="font-medium text-slate-900">v1.2.3</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-600">Last Updated:</span>
              <span className="font-medium text-slate-900">March 4, 2026</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-600">File Name:</span>
              <span className="font-medium text-slate-900">_otsuka-detailer.apk</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 w-full max-w-4xl px-4 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-2 text-2xl font-semibold text-slate-900">Expo Installation</h2>
          <p className="mb-5 text-slate-600">
            Need the full Expo Go setup tutorial? Follow the steps below and watch the installation
            video.
          </p>

          <div className="grid gap-6 md:grid-cols-2 md:items-start">
            <ol className="list-decimal space-y-2 pl-5 text-slate-700">
              <li>Go to App Store.</li>
              <li>Search for <span className="font-semibold">Expo Go</span>.</li>
              <li>Once you find the app, tap download.</li>
              <li>Wait until the download is finished.</li>
              <li>Once completed, tap open.</li>
              <li>Log in using your Expo username and password.</li>
              <li>Tap <span className="font-semibold">Detailer App</span>.</li>
              <li>Tap <span className="font-semibold">Branch: production</span>.</li>
              <li>Tap <span className="font-semibold">Update</span> at the top.</li>
              <li>Sign in with your username and password.</li>
            </ol>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
              <video
                className="w-full"
                controls
                preload="metadata"
                aria-label="Tutorial video for installing the Otsuka One Detailer application"
              >
                <source
                  src="/videos/tutorial%20on%20how%20to%20install%20the%20application.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 w-full max-w-4xl px-4 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold text-slate-900">Quick Access</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickLinkCard href="/dashboard" title="Go to Dashboard" icon={<DashboardIcon />} />
          <QuickLinkCard
            href="/privacy-policy"
            title="View Privacy Policy"
            icon={<BookIcon />}
          />
          <QuickLinkCard href="/login" title="Go to Login" icon={<LoginIcon />} />
        </div>
      </section>

      <footer className="mt-16 border-t border-slate-200 bg-white py-8">
        <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-1 font-semibold text-slate-800">Otsuka One Detailer</p>
          <p className="text-sm text-slate-600">Internal Beta Distribution System</p>
        </div>
      </footer>
    </div>
  );
}
