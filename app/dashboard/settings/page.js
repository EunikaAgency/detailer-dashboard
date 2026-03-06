"use client";

import { useEffect, useMemo, useState } from "react";

const EyeIcon = ({ closed = false }) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    {closed ? <path d="M3 3l18 18" /> : null}
  </svg>
);

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [apiLoginRequired, setApiLoginRequired] = useState(true);
  const [isLoadingApiSetting, setIsLoadingApiSetting] = useState(true);
  const [isSavingApiSetting, setIsSavingApiSetting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadApiAccessSetting = async () => {
      setIsLoadingApiSetting(true);
      try {
        const response = await fetch("/api/settings/api-access", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load API access setting.");
        }
        if (!active) return;
        setApiLoginRequired(payload?.apiLoginRequired !== false);
      } catch (error) {
        if (!active) return;
        setToast({
          type: "error",
          message: error?.message || "Failed to load API access setting.",
        });
      } finally {
        if (active) setIsLoadingApiSetting(false);
      }
    };

    loadApiAccessSetting();
    return () => {
      active = false;
    };
  }, []);

  const validationError = useMemo(() => {
    if (!currentPassword || !newPassword || !confirmNewPassword) return "";
    if (newPassword.length < 8) return "New password must be at least 8 characters.";
    if (newPassword !== confirmNewPassword) return "New passwords do not match.";
    if (currentPassword === newPassword) return "New password must be different from current password.";
    return "";
  }, [confirmNewPassword, currentPassword, newPassword]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setToast(null);

    if (validationError) {
      setToast({ type: "error", message: validationError });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setToast({ type: "error", message: payload?.error || "Failed to change password." });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setToast({ type: "success", message: "Password changed successfully." });
    } catch (error) {
      setToast({ type: "error", message: "Network error while changing password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleApiLoginRequired = async () => {
    if (isLoadingApiSetting || isSavingApiSetting) return;
    const previousValue = apiLoginRequired;
    const nextValue = !previousValue;

    setApiLoginRequired(nextValue);
    setIsSavingApiSetting(true);
    setToast(null);

    try {
      const response = await fetch("/api/settings/api-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiLoginRequired: nextValue }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update API access setting.");
      }
      setApiLoginRequired(payload?.apiLoginRequired !== false);
      setToast({
        type: "success",
        message: "API login requirement updated.",
      });
    } catch (error) {
      setApiLoginRequired(previousValue);
      setToast({
        type: "error",
        message: error?.message || "Failed to update API access setting.",
      });
    } finally {
      setIsSavingApiSetting(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">API Access</h2>
          <p className="text-sm text-gray-600 mt-1">
            Enable this to require logged-in users for all non-auth API routes.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Require login for all APIs</p>
            <p className="text-xs text-gray-600 mt-1">
              {apiLoginRequired ? "Enabled" : "Disabled"}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={apiLoginRequired}
            disabled={isLoadingApiSetting || isSavingApiSetting}
            onClick={handleToggleApiLoginRequired}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              apiLoginRequired ? "bg-blue-600" : "bg-gray-300"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                apiLoginRequired ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 space-y-4"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
          <p className="text-sm text-gray-600 mt-1">Update your account password.</p>
        </div>

        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Current Password
          </label>
          <div className="relative">
            <input
              id="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
              aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
            >
              <EyeIcon closed={showCurrentPassword} />
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
              aria-label={showNewPassword ? "Hide new password" : "Show new password"}
            >
              <EyeIcon closed={showNewPassword} />
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Retype New Password
          </label>
          <div className="relative">
            <input
              id="confirmNewPassword"
              type={showConfirmNewPassword ? "text" : "password"}
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmNewPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
              aria-label={showConfirmNewPassword ? "Hide retype new password" : "Show retype new password"}
            >
              <EyeIcon closed={showConfirmNewPassword} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Saving..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
