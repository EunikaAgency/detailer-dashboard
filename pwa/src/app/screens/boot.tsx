import { useEffect } from "react";
import { useNavigate } from "react-router";
import { isAuthenticated } from "../lib/auth";
import { initializeConfig } from "../lib/config";

export default function Boot() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function bootApp() {
      try {
        await initializeConfig();

        if (!active) {
          return;
        }

        navigate(isAuthenticated() ? "/presentations" : "/login", { replace: true });
      } catch {
        if (!active) {
          return;
        }

        navigate("/boot-failure", { replace: true });
      }
    }

    void bootApp();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Loading One Detailer</h1>
        <p className="text-sm text-slate-600">Initializing your presentation experience...</p>
        <div className="mt-6 space-y-2 text-xs text-slate-500">
          <p>• Authenticating</p>
          <p>• Loading settings</p>
          <p>• Preparing content</p>
        </div>
      </div>
    </div>
  );
}
