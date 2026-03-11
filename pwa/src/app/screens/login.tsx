import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { login as performLogin, getSavedCredentials } from "../lib/auth";
import { initializeSession, trackOfflineGranted } from "../lib/sessions";

type AutoLoginCredentials = {
  identifier: string;
  password: string;
  remember: boolean;
};

function parseAutoLoginCredentials(search: string): AutoLoginCredentials | null {
  const params = new URLSearchParams(search);
  const identifier =
    [
      params.get("employeeId"),
      params.get("oppi"),
      params.get("identifier"),
      params.get("username"),
      params.get("login"),
    ]
      .map((value) => String(value || "").trim())
      .find(Boolean) || "";
  const password = String(params.get("password") || "").trim();
  const rememberRaw = String(params.get("remember") || "").trim().toLowerCase();
  const remember = rememberRaw
    ? !["0", "false", "no", "off"].includes(rememberRaw)
    : true;

  if (!identifier || !password) {
    return null;
  }

  return {
    identifier,
    password,
    remember,
  };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const savedCreds = getSavedCredentials();
  const autoLoginStartedRef = useRef(false);
  
  const [username, setUsername] = useState(savedCreds?.identifier || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(!!savedCreds);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoLoginPending, setAutoLoginPending] = useState(false);

  const submitSignIn = async (identifier: string, secret: string, rememberCredentials: boolean) => {
    setError("");
    setIsLoading(true);

    try {
      const result = await performLogin(identifier, secret, rememberCredentials);
      
      if (result.success) {
        // Track login event with appropriate action
        const source = result.mode === 'offline' ? 'offline' : 'online';
        
        if (result.mode === 'offline') {
          // Use dedicated tracking function for offline auth
          trackOfflineGranted();
        } else {
          // Track online login
          initializeSession('password', source);
        }
        
        // Navigate to presentations
        navigate("/presentations");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setAutoLoginPending(false);
    }
  };

  useEffect(() => {
    const autoLoginCredentials = parseAutoLoginCredentials(location.search);
    if (!autoLoginCredentials || autoLoginStartedRef.current) {
      return;
    }

    autoLoginStartedRef.current = true;
    setUsername(autoLoginCredentials.identifier);
    setPassword(autoLoginCredentials.password);
    setRemember(autoLoginCredentials.remember);
    setAutoLoginPending(true);
    const clearedUrl = new URL(window.location.href);
    clearedUrl.search = "";
    window.history.replaceState(window.history.state, "", clearedUrl.toString());

    const timeoutId = window.setTimeout(() => {
      void submitSignIn(
        autoLoginCredentials.identifier,
        autoLoginCredentials.password,
        autoLoginCredentials.remember
      );
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitSignIn(username, password, remember);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">One Detailer</h1>
            <p className="text-sm text-slate-500">Sign in to continue</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {autoLoginPending && !error && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <LoaderCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0 animate-spin" />
              <p className="text-sm text-blue-700">Incoming sign-in link detected. Signing in automatically...</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Employee ID */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Employee ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                disabled={isLoading}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Enter Employee ID"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Pass
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                disabled={isLoading}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Enter password"
              />
            </div>

            {/* Remember Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-slate-700">
                Remember credentials
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing you in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
