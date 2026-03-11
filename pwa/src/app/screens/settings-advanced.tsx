import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { AlertTriangle, Download, FileText, Trash2, WifiOff } from "lucide-react";
import { useState, useEffect } from "react";
import { getSettings, updateSettings, exportDiagnostics, downloadDiagnostics, setSessionsVisibility, type AppSettings } from "../lib/settings";
import { clearAllData } from "../lib/auth";
import { trackEvent } from "../lib/sessions";
import { useNavigate } from "react-router";
import { SegmentedControl } from "../components/ui/segmented-control";

export default function SettingsAdvanced() {
  const navigate = useNavigate();
  const screenId = "settings-advanced";
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  useEffect(() => {
    trackEvent('activity', 'screen_view', 'settings-advanced');
  }, []);

  const handleToggle = (key: keyof AppSettings, value: boolean) => {
    const updated = updateSettings({ [key]: value });
    setSettings(updated);
  };

  const handleSelect = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = updateSettings({ [key]: value } as Partial<AppSettings>);
    setSettings(updated);
  };

  const handleSessionsVisibilityToggle = (enabled: boolean) => {
    const updated = setSessionsVisibility(enabled);
    setSettings(updated);
  };

  const handleCopyLogs = () => {
    const diagnostics = exportDiagnostics();
    navigator.clipboard.writeText(diagnostics);
    alert('Diagnostics copied to clipboard');
  };

  const handleDownloadLogs = () => {
    downloadDiagnostics();
  };

  const handleResetCache = () => {
    if (confirm('This will clear all cached data and log you out. Continue?')) {
      trackEvent('activity', 'cache_reset', 'settings-advanced');
      clearAllData();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="Advanced" showBack backTo="/settings" />

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Warning Banner */}
        <Card id={`${screenId}-warning-card`} className="p-4 bg-amber-50 border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-900 mb-1">Advanced Settings</div>
            <div className="text-sm text-amber-700">
              These settings are intended for troubleshooting and testing. Changes may affect app behavior.
            </div>
          </div>
        </Card>

        {/* Developer Options */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 px-1">Developer Options</h2>
          
          <Card id={`${screenId}-developer-options-card`} className="divide-y divide-slate-200">
            <div className="p-4">
              <div className="font-medium text-slate-900 mb-1">Offline presentation caching</div>
              <div className="text-sm text-slate-500 mb-3">
                Automatic keeps presentations available offline without extra prompts. Manual shows save controls in the app.
              </div>
              <SegmentedControl
                options={[
                  { value: "automatic", label: "Automatic" },
                  { value: "manual", label: "Manual" },
                ]}
                value={settings.offlineAccessMode}
                onChange={(value) => handleSelect("offlineAccessMode", value as AppSettings["offlineAccessMode"])}
              />
            </div>

            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-900">Show sessions</div>
                <div className="text-sm text-slate-500">
                  Shows session history in the menu.
                </div>
                {settings.showSessions && settings.sessionsVisibilityExpiresAt && (
                  <div className="mt-2 text-xs text-slate-400">
                    Visible until{" "}
                    {new Date(settings.sessionsVisibilityExpiresAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showSessions}
                  onChange={(e) => handleSessionsVisibilityToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            {/* Show Hotspot Areas */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Show hotspot areas</div>
                <div className="text-sm text-slate-500">Display interactive regions on slides</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showHotspotAreas}
                  onChange={(e) => handleToggle('showHotspotAreas', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            {/* Debug Mode */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Debug mode</div>
                <div className="text-sm text-slate-500">Show technical metadata and timestamps</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.debugMode}
                  onChange={(e) => handleToggle('debugMode', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </Card>
        </div>

        {/* Diagnostics */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 px-1">Diagnostics</h2>
          
          <Card id={`${screenId}-diagnostics-card`} className="divide-y divide-slate-200">
            <button
              onClick={() => navigate("/offline")}
              className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
            >
              <WifiOff className="w-5 h-5 text-slate-600" />
              <div className="flex-1">
                <div className="font-medium text-slate-900">Offline support</div>
                <div className="text-sm text-slate-500">Deck integrity, storage, and repair tools</div>
              </div>
            </button>

            <button
              onClick={handleCopyLogs}
              className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-slate-600" />
              <div className="flex-1">
                <div className="font-medium text-slate-900">Copy diagnostic logs</div>
                <div className="text-sm text-slate-500">Copy app state to clipboard</div>
              </div>
            </button>

            <button
              onClick={handleDownloadLogs}
              className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
            >
              <Download className="w-5 h-5 text-slate-600" />
              <div className="flex-1">
                <div className="font-medium text-slate-900">Download diagnostic report</div>
                <div className="text-sm text-slate-500">Export full diagnostics as JSON</div>
              </div>
            </button>
          </Card>
        </div>

        {/* Cache Management */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 px-1">Cache Management</h2>
          
          <Card id={`${screenId}-cache-management-card`}>
            <button
              onClick={handleResetCache}
              className="w-full p-4 flex items-center gap-3 hover:bg-red-50 transition-colors text-left"
            >
              <Trash2 className="w-5 h-5 text-red-600" />
              <div className="flex-1">
                <div className="font-medium text-red-900">Reset all cached data</div>
                <div className="text-sm text-red-600">Clear storage and log out</div>
              </div>
            </button>
          </Card>
        </div>

        {/* App Info */}
        <Card id={`${screenId}-app-info-card`} className="p-4">
          <h3 className="font-medium text-slate-900 mb-3">App Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Version</span>
              <span className="font-medium text-slate-900">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Build</span>
              <span className="font-medium text-slate-900">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Environment</span>
              <span className="font-medium text-slate-900">PWA</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
