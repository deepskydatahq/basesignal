import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AmplitudeEvent {
  name: string;
  description?: string;
}

export default function AmplitudeEventsPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();

  const connection = useQuery(
    api.amplitude.getById,
    connectionId ? { id: connectionId as Id<"amplitudeConnections"> } : "skip"
  );
  const listEvents = useAction(api.amplitudeActions.listEvents);
  const updateSelectedEvents = useMutation(api.amplitude.updateSelectedEvents);

  const [events, setEvents] = useState<AmplitudeEvent[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore previously selected events when navigating back
  useEffect(() => {
    if (connection?.selectedEvents && connection.selectedEvents.length > 0) {
      setSelectedEvents(new Set(connection.selectedEvents));
    }
  }, [connection?.selectedEvents]);

  useEffect(() => {
    async function fetchEvents() {
      if (!connection) return;

      setLoading(true);
      setError(null);

      try {
        const result = await listEvents({
          apiKey: connection.apiKey,
          secretKey: connection.secretKey,
        });

        if (result.success && result.events) {
          setEvents(result.events);
        } else {
          setError(result.error || "Failed to fetch events");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const filteredEvents = events.filter((event) =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleEvent = (eventName: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventName)) {
        next.delete(eventName);
      } else {
        next.add(eventName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedEvents(new Set(filteredEvents.map((e) => e.name)));
  };

  const handleClearAll = () => {
    setSelectedEvents(new Set());
  };

  const handleContinue = async () => {
    if (!connectionId) return;

    try {
      await updateSelectedEvents({
        id: connectionId as Id<"amplitudeConnections">,
        selectedEvents: Array.from(selectedEvents),
      });
      navigate(`/sources/amplitude/${connectionId}/confirm`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save selection");
    }
  };

  if (!connection) {
    return <div className="container mx-auto py-6">Loading connection...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Events to Sync</CardTitle>
          <CardDescription>
            Choose which Amplitude events to include in your data pipeline.
            {events.length > 0 && ` Found ${events.length} events.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading events from Amplitude...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  Clear
                </Button>
              </div>

              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No events match your search" : "No events found"}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEvents.map((event) => (
                      <label
                        key={event.name}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedEvents.has(event.name)}
                          onCheckedChange={() => handleToggleEvent(event.name)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm">{event.name}</div>
                          {event.description && (
                            <div className="text-sm text-muted-foreground truncate">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedEvents.size} events selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate("/sources")}>
                    Cancel
                  </Button>
                  <Button onClick={handleContinue} disabled={selectedEvents.size === 0}>
                    Continue
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
