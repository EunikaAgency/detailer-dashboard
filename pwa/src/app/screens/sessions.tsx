import { useNavigate } from "react-router";
import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { Pill } from "../components/ui/pill";
import { ActionButton } from "../components/ui/action-button";
import { Clock, RefreshCw } from "lucide-react";
import { getSessionsFromEvents, subscribeSessionState, syncPendingEvents } from "../lib/sessions";
import { useState, useEffect } from "react";
import { useAppSettings } from "../lib/settings";

export default function Sessions() {
  const navigate = useNavigate();
  const screenId = "sessions";
  const settings = useAppSettings();
  const [sessions, setSessions] = useState(() => getSessionsFromEvents());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!settings.showSessions) {
      navigate("/menu", { replace: true });
    }
  }, [navigate, settings.showSessions]);

  useEffect(() => {
    const refreshSessions = () => {
      setSessions(getSessionsFromEvents());
    };

    refreshSessions();

    return subscribeSessionState(refreshSessions);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncPendingEvents();
    // Refresh sessions to update sync status
    setSessions(getSessionsFromEvents());
    setIsSyncing(false);
  };

  if (!settings.showSessions) {
    return null;
  }

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader 
        title="Sessions" 
        showBack 
        backTo="/menu"
        rightActions={
          <ActionButton
            onClick={handleSync}
            disabled={isSyncing}
            aria-label="Sync sessions"
            label="Sync"
            icon={<RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />}
          />
        }
      />

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <p className="text-sm text-slate-600 mb-4">
          Your presentation activities are grouped by session. Each session tracks the moves and interactions during a visit.
        </p>

        {sessions.length === 0 ? (
          <Card id={`${screenId}-empty-card`} className="p-8 text-center">
            <p className="text-slate-500">No sessions recorded yet</p>
            <p className="text-sm text-slate-400 mt-2">
              Sessions will appear here as you use the app
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card
                id={`${screenId}-session-card-${session.id}`}
                key={session.id}
                onClick={() => navigate(`/sessions/${session.id}`)}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-slate-900 flex-1">{session.title}</h3>
                  <Pill variant={session.status === "synced" ? "success" : "warning"}>
                    {session.status === "synced" ? "Synced" : "Pending"}
                  </Pill>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                  <Clock className="w-4 h-4" />
                  <span>{session.timeRange}</span>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-600">
                    <span className="font-medium text-slate-900">{session.moveCount}</span> moves
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">
                    <span className="font-medium text-slate-900">{session.duration}</span> duration
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
