import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { StickyHeader } from "../components/ui/sticky-header";
import { Card } from "../components/ui/card";
import { Pill } from "../components/ui/pill";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import { getSessionById, subscribeSessionState } from "../lib/sessions";
import { useAppSettings } from "../lib/settings";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const settings = useAppSettings();
  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);
  const [session, setSession] = useState(() => (id ? getSessionById(id) : null));

  useEffect(() => {
    if (!settings.showSessions) {
      navigate("/menu", { replace: true });
    }
  }, [navigate, settings.showSessions]);

  useEffect(() => {
    if (!id) {
      setSession(null);
      return;
    }

    const refreshSession = () => {
      setSession(getSessionById(id));
    };

    refreshSession();

    return subscribeSessionState(refreshSession);
  }, [id]);

  if (!settings.showSessions) {
    return null;
  }

  if (!session) {
    return (
      <div className="min-h-screen pb-6">
        <StickyHeader title="Session Details" showBack backTo="/sessions" />
        <div className="max-w-2xl mx-auto px-4 mt-6">
          <Card className="p-8 text-center">
            <p className="text-slate-500">Session not found</p>
            <button
              onClick={() => navigate("/sessions")}
              className="mt-4 text-blue-500 hover:text-blue-600"
            >
              Back to Sessions
            </button>
          </Card>
        </div>
      </div>
    );
  }

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  return (
    <div className="min-h-screen pb-6">
      <StickyHeader title="Session Details" showBack backTo="/sessions" />

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        {/* Session Summary */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="font-semibold text-slate-900 flex-1">{session.title}</h2>
            <Pill variant={session.status === "synced" ? "success" : "warning"}>
              {session.status === "synced" ? "Synced" : "Pending"}
            </Pill>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
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

        {/* Session Statistics */}
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Session Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-600 mb-1">Total events</div>
              <div className="text-2xl font-semibold text-slate-900">{session.events.length}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Screen views</div>
              <div className="text-2xl font-semibold text-slate-900">{session.moveCount}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Duration</div>
              <div className="text-2xl font-semibold text-slate-900">{session.duration}</div>
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Status</div>
              <div className="mt-1">
                <Pill variant={session.status === "synced" ? "success" : "warning"}>
                  {session.status === "synced" ? "Synced" : "Pending"}
                </Pill>
              </div>
            </div>
          </div>
        </Card>

        {/* Event Timeline */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-3 px-1">Event Timeline</h3>
          <div className="space-y-2">
            {session.events.map((event) => {
              const isExpanded = expandedEvents.includes(event.id);
              const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
              
              const eventTime = new Date(event.timestampMs).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              
              return (
                <Card
                  key={event.id}
                  className={`p-4 ${hasMetadata ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  onClick={hasMetadata ? () => toggleEvent(event.id) : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 mb-1">
                        {event.action.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-slate-500">
                        {event.screen} • {event.eventType}
                      </div>
                      
                      {isExpanded && event.metadata && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="text-xs font-medium text-slate-600 mb-2">Event Metadata</div>
                          <div className="bg-slate-50 rounded p-3 font-mono text-xs">
                            <pre className="text-slate-700 overflow-x-auto">
                              {JSON.stringify(event.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm text-slate-500">{eventTime}</span>
                      {hasMetadata && (
                        isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
