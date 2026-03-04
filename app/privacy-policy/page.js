import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Otsuka Detailer",
  description: "Privacy policy for the Otsuka Detailer admin platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-4">
      <main className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-8 shadow-xl md:p-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mb-8 text-sm text-gray-600">Effective date: February 27, 2026</p>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Overview</h2>
          <p className="text-gray-700">
            This Privacy Policy explains how Otsuka Detailer collects, uses, and protects
            information processed through this platform.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Information We Collect</h2>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>Account details such as name, username, and email address.</li>
            <li>Authentication and session data needed to keep the platform secure.</li>
            <li>Operational activity data used for usage reporting and diagnostics.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">How We Use Information</h2>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>To provide and maintain core platform functionality.</li>
            <li>To secure accounts, monitor access, and prevent unauthorized use.</li>
            <li>To improve performance, reliability, and reporting features.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Data Security</h2>
          <p className="text-gray-700">
            Reasonable administrative and technical controls are used to protect data from
            unauthorized access, use, or disclosure.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Data Retention</h2>
          <p className="text-gray-700">
            Data is retained only as long as needed for business operations, legal obligations,
            and security requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Contact</h2>
          <p className="text-gray-700">
            For privacy-related questions, contact your system administrator.
          </p>
        </section>

        <div className="border-t border-gray-200 pt-6">
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Back to Login
          </Link>
        </div>
      </main>
    </div>
  );
}
