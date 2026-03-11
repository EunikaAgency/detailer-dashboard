import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { getAccountProfile } from "../lib/auth";

export default function Account() {
  const screenId = "account";
  const profile = getAccountProfile();

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

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="My Account" showBack backTo="/menu" />

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <Card id={`${screenId}-profile-card`} className="p-6">
          <div className="space-y-4">
            {/* Representative Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Representative Name
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.representativeName || '—'}
              </div>
            </div>

            {/* OPPI */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                OPPI
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.username || '—'}
              </div>
            </div>

            {/* Issued Login OPPI */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Issued login OPPI
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.issuedLoginUsername || '—'}
              </div>
            </div>

            {/* Rep ID */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Rep ID
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.repId || '—'}
              </div>
            </div>

            {/* Team */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Team
              </label>
              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                {profile.role || '—'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
