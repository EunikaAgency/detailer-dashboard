import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | One Detailer",
  description: "Privacy policy for the One Detailer platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-4">
      <main className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-8 shadow-xl md:p-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mb-8 text-sm text-gray-600">Effective Date: February 27, 2026</p>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Introduction</h2>
          <p className="text-gray-700">
            This Privacy Policy explains how One Detailer handles information when you access or
            use the platform.
          </p>
          <p className="mt-3 text-gray-700">
            One Detailer is designed as a presentation and content viewer that allows users to
            browse and display visual materials and slides in a structured interface.
          </p>
          <p className="mt-3 text-gray-700">
            We are committed to protecting user privacy and limiting the processing of information
            to what is necessary for the platform to function.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Information We Process</h2>
          <p className="text-gray-700">
            To provide access to the platform, limited account-related information may be
            processed, including:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>Name or display name</li>
            <li>Username or login identifier</li>
            <li>Email address</li>
          </ul>
          <p className="mt-3 text-gray-700">
            This information is used solely for authentication and account access.
          </p>
          <p className="mt-3 text-gray-700">
            The platform may also process minimal technical information required to maintain system
            operation, such as session status or basic diagnostic data.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Information We Do Not Collect</h2>
          <p className="text-gray-700">
            One Detailer does not collect or use personal data for advertising or marketing
            purposes.
          </p>
          <p className="mt-3 text-gray-700">The platform does not:</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>track users across other apps or websites</li>
            <li>collect location data</li>
            <li>collect contacts or personal media</li>
            <li>use advertising identifiers</li>
            <li>use third-party analytics or tracking tools</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">How Information Is Used</h2>
          <p className="text-gray-700">Any information processed by the platform is used only to:</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>authenticate users</li>
            <li>maintain secure access to the platform</li>
            <li>prevent unauthorized access or misuse</li>
            <li>maintain platform stability and reliability</li>
          </ul>
          <p className="mt-3 text-gray-700">
            Information is not used for profiling, advertising, or behavioral tracking.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Data Sharing</h2>
          <p className="text-gray-700">
            Information processed by the platform is not sold, rented, or shared with third parties
            for marketing purposes.
          </p>
          <p className="mt-3 text-gray-700">Information may only be disclosed:</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>when required by law</li>
            <li>to protect the security or integrity of the platform</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Data Security</h2>
          <p className="text-gray-700">
            Reasonable administrative and technical safeguards are implemented to help protect
            information against unauthorized access, disclosure, or misuse.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Data Retention</h2>
          <p className="text-gray-700">
            Information is retained only for as long as necessary to:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>maintain account access</li>
            <li>ensure platform security</li>
            <li>comply with applicable legal obligations</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Children&apos;s Privacy</h2>
          <p className="text-gray-700">
            One Detailer is not directed toward children under the age of 13, and the platform is
            not intended to collect information from children.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Changes to This Policy</h2>
          <p className="text-gray-700">
            This Privacy Policy may be updated periodically to reflect improvements to the platform
            or changes in applicable regulations.
          </p>
          <p className="mt-3 text-gray-700">
            When updates occur, the effective date will be revised.
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
