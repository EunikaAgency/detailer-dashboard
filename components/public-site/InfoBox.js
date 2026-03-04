export default function InfoBox({ title, children }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <p className="text-sm text-blue-900">
        <span className="font-semibold">{title}</span> {children}
      </p>
    </div>
  );
}
