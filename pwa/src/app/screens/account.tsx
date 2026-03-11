import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { getAccountProfile, getAuthMode, syncStoredPassword } from "../lib/auth";
import { apiClient } from "../lib/api";

export default function Account() {
  const screenId = "account";
  const profile = getAccountProfile();
  const authMode = getAuthMode();
  const passwordChangeBlocked = authMode === "offline";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordHint = useMemo(() => {
    if (passwordChangeBlocked) {
      return "Changing your login password requires an online session. It does not change the admin secret keygen.";
    }

    return "Use at least 8 characters";
  }, [passwordChangeBlocked]);

  // If no profile, show minimal state
  if (!profile) {
    return (
      <div className="min-h-screen pb-6">
        <StickyHeader title="My Account" showBack backTo="/menu" />
        <div className="max-w-2xl mx-auto px-4 mt-6">
          <Card id={`${screenId}-empty-card`} className="p-6">
            <p className="text-sm text-slate-500">No account information available</p>
          </Card>
        </div>
      </div>
    );
  }

  const handlePasswordReplace = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (passwordChangeBlocked) {
      setError("Reconnect online before replacing your password.");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Fill in all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation must match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Choose a different replacement password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.changePassword({
        currentPassword,
        newPassword,
      });

      syncStoredPassword(newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(response.message || "Password replaced successfully.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to replace password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="My Account" showBack backTo="/menu" />

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        <Card id={`${screenId}-profile-card`} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Representative Name
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.representativeName || "—"}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                OPPI
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.username || "—"}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Issued login OPPI
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.issuedLoginUsername || "—"}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Rep ID
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.repId || "—"}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Team
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.role || "—"}
              </div>
            </div>
          </div>
        </Card>

        <Card id={`${screenId}-replace-password-card`} className="p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Change Login Password</h2>
              <p className="text-sm text-slate-500 mt-1">{passwordHint}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-700">{success}</p>
            </div>
          )}

          <form onSubmit={handlePasswordReplace} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Current login password
              </label>
              <div className="relative">
                <input
                  id={`${screenId}-current-password-input`}
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  disabled={isSubmitting || passwordChangeBlocked}
                  className="w-full px-3 py-2.5 pr-11 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="Enter current login password"
                />
                <button
                  type="button"
                  aria-label={showCurrentPassword ? "Hide current login password" : "Show current login password"}
                  onClick={() => setShowCurrentPassword((current) => !current)}
                  disabled={isSubmitting || passwordChangeBlocked}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                New login password
              </label>
              <div className="relative">
                <input
                  id={`${screenId}-new-password-input`}
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  disabled={isSubmitting || passwordChangeBlocked}
                  className="w-full px-3 py-2.5 pr-11 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="Enter new login password"
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? "Hide new login password" : "Show new login password"}
                  onClick={() => setShowNewPassword((current) => !current)}
                  disabled={isSubmitting || passwordChangeBlocked}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Confirm new login password
              </label>
              <div className="relative">
                <input
                  id={`${screenId}-confirm-password-input`}
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  disabled={isSubmitting || passwordChangeBlocked}
                  className="w-full px-3 py-2.5 pr-11 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="Confirm new login password"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirmed login password" : "Show confirmed login password"}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  disabled={isSubmitting || passwordChangeBlocked}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id={`${screenId}-replace-password-button`}
              type="submit"
              disabled={isSubmitting || passwordChangeBlocked}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Changing login password..." : "Change login password"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
