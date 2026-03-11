import { useNavigate } from "react-router";
import { AlertCircle } from "lucide-react";
import { clearAllData } from "../lib/auth";

export default function BootFailure() {
  const navigate = useNavigate();

  const handleReload = () => {
    window.location.reload();
  };

  const handleResetCache = () => {
    if (confirm("This will clear all cached data and reload the app. Continue?")) {
      clearAllData();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          One Detailer could not start
        </h1>
        
        <p className="text-slate-600 mb-8">
          We encountered an issue while loading the application. This may be due to a connectivity problem or corrupted cache. Please try reloading or resetting your cached data.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleReload}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium"
          >
            Reload app
          </button>
          
          <button
            onClick={handleResetCache}
            className="w-full text-slate-600 hover:text-slate-900 py-3 rounded-lg font-medium border border-slate-200 hover:bg-slate-50"
          >
            Reset cached data
          </button>
        </div>
      </div>
    </div>
  );
}