import Link from "next/link";

const BASE_CLASS =
  "inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export default function PrimaryButton({ href, children, download = false }) {
  if (!href) {
    return <button className={BASE_CLASS}>{children}</button>;
  }

  if (download) {
    return (
      <a href={href} download className={BASE_CLASS}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={BASE_CLASS}>
      {children}
    </Link>
  );
}
