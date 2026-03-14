import { useNavigate } from "react-router";
import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { User, Clock, Settings as SettingsIcon, Download, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppSettings } from "../lib/settings";
import { getInstallState, handleInstallAction, initPWAInstall, subscribeInstallState } from "../lib/pwa";
import { trackEvent } from "../lib/sessions";

export default function Menu() {
  const navigate = useNavigate();
  const screenId = "menu";
  const [installState, setInstallState] = useState(getInstallState());
  const settings = useAppSettings();

  useEffect(() => {
    trackEvent('activity', 'screen_view', 'menu');
    
    // Initialize PWA install detection
    initPWAInstall();

    const unsubscribe = subscribeInstallState((state) => {
      setInstallState(state);
    });

    return unsubscribe;
  }, []);

  const handleInstallClick = async () => {
    const result = await handleInstallAction();
    
    if (result === 'instructions') {
      navigate('/install');
    }
    
    // Update state after install attempt
    setInstallState(getInstallState());
  };

  const installButtonLabel = installState.canPrompt ? 'Install App' : 'How To Install';

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="Menu" showBack backTo="/presentations" />

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-3">
        {/* My Account */}
        <Card
          id={`${screenId}-account-card`}
          onClick={() => navigate("/account")}
          className="p-4 flex items-center gap-3"
        >
          <div className="p-2 bg-blue-50 rounded-lg">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-slate-900">My Account</div>
            <div className="text-sm text-slate-500">View profile information</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Card>

        {settings.showSessions && (
          <Card
            id={`${screenId}-sessions-card`}
            onClick={() => navigate("/sessions")}
            className="p-4 flex items-center gap-3"
          >
            <div className="p-2 bg-green-50 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900">Sessions</div>
              <div className="text-sm text-slate-500">Activity history and tracking</div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </Card>
        )}

        {/* Settings */}
        <Card
          id={`${screenId}-settings-card`}
          onClick={() => navigate("/settings")}
          className="p-4 flex items-center gap-3"
        >
          <div className="p-2 bg-slate-100 rounded-lg">
            <SettingsIcon className="w-5 h-5 text-slate-600" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-slate-900">Settings</div>
            <div className="text-sm text-slate-500">Preferences and configuration</div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Card>

        {/* Install App (conditional) */}
        {installState.showAction && (
          <Card
            id={`${screenId}-install-card`}
            onClick={handleInstallClick}
            className="p-4 flex items-center gap-3"
          >
            <div className="p-2 bg-purple-50 rounded-lg">
              <Download className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900">{installButtonLabel}</div>
              <div className="text-sm text-slate-500">
                {installState.canPrompt
                  ? 'Use the native install prompt for app-style launch'
                  : 'Manual install instructions for this device'}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </Card>
        )}
      </div>
    </div>
  );
}
