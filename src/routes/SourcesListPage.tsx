import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { SourceCard } from "@/components/SourceCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SourcesListPage() {
  const sources = useQuery(api.sources.list);
  const amplitudeConnections = useQuery(api.amplitude.list);

  // Find most recent lastCheckedAt across all sources
  const lastChecked = sources?.reduce((latest, source) => {
    if (!latest) return source.lastCheckedAt;
    return source.lastCheckedAt > latest ? source.lastCheckedAt : latest;
  }, null as string | null);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Sources</h1>
          {lastChecked && (
            <p className="text-sm text-gray-500">
              Last checked:{" "}
              {formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}
            </p>
          )}
        </div>
        <Button asChild>
          <Link to="/sources/amplitude/connect">
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Link>
        </Button>
      </div>

      {/* Amplitude Connections */}
      {amplitudeConnections && amplitudeConnections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-medium text-gray-900">Amplitude</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {amplitudeConnections.map((conn) => (
              <Link
                key={conn._id}
                to={`/sources/amplitude/${conn._id}/confirm`}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{conn.name}</span>
                  <span className={`inline-block w-3 h-3 rounded-full ${
                    conn.status === "connected" ? "bg-green-500" :
                    conn.status === "syncing" ? "bg-blue-500" :
                    conn.status === "pending" || conn.status === "creating" ? "bg-yellow-500" :
                    conn.status === "error" ? "bg-red-500" :
                    "bg-gray-400"
                  }`} />
                </div>
                <p className="text-sm text-gray-500">
                  Status: {conn.status} <span className="font-mono">{conn.selectedEvents.length}</span> events
                </p>
                {conn.lastRunAt && (
                  <p className="text-sm text-gray-500">
                    Last sync: {formatDistanceToNow(new Date(conn.lastRunAt), { addSuffix: true })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sources Grid */}
      {sources === undefined ? (
        <div className="text-center py-12 text-gray-500">
          Loading sources...
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No sources configured. Run the sync script to populate data.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sources.map((source) => (
            <SourceCard key={source._id} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}
