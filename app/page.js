"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const normalizeDashboardPath = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!normalized.startsWith("/dashboard")) return "";
  if (normalized.startsWith("//")) return "";
  return normalized;
};

function HomeContent() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedIdentifier = identifier.trim();
      const looksLikeEmail = normalizedIdentifier.includes("@");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: looksLikeEmail ? normalizedIdentifier : "",
          username: looksLikeEmail ? "" : normalizedIdentifier,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      const nextFromQuery = normalizeDashboardPath(searchParams.get("next"));
      let nextFromStorage = "";
      try {
        nextFromStorage = normalizeDashboardPath(window.localStorage.getItem("last_dashboard_path"));
      } catch {
        nextFromStorage = "";
      }
      router.push(nextFromQuery || nextFromStorage || "/dashboard");
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Otsuka Admin
          </h1>
          <p className="text-gray-600">Sign in to manage the dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or username"
              className="w-full px-4 py-3 bg-blue-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              required
            />
          </div>
          
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-4 py-3 pr-12 bg-blue-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                  <path d="M9.88 5.09A10.94 10.94 0 0112 5c5.05 0 9.27 3.11 10 7-.2 1.06-.66 2.06-1.31 2.95M6.61 6.61C4.62 7.84 3.22 9.77 2 12c.73 3.89 4.95 7 10 7 1.72 0 3.34-.36 4.78-1" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.64-7 10-7 10 7 10 7-3.64 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
            Need an account? <span className="font-semibold">Sign up</span>
          </a>
        </div>
      </main>
    </div>
  );
}

function HomeFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl text-center text-gray-600">
        Loading...
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}
