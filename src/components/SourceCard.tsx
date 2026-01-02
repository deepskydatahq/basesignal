import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

interface SourceTable {
  name: string;
  bqTable: string;
  freshnessThresholdHours: number;
  lastSyncAt?: string;
  rowCount?: number;
}

interface Source {
  _id: string;
  name: string;
  displayName: string;
  dagsterJobUrl?: string;
  tables: SourceTable[];
  lastCheckedAt: string;
}

type FreshnessStatus = "fresh" | "stale" | "critical";

function getTableStatus(table: SourceTable): FreshnessStatus {
  if (!table.lastSyncAt) return "critical";

  const lastSync = new Date(table.lastSyncAt);
  const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  const threshold = table.freshnessThresholdHours;

  if (hoursAgo <= threshold) return "fresh";
  if (hoursAgo <= threshold * 2) return "stale";
  return "critical";
}

function getSourceStatus(tables: SourceTable[]): FreshnessStatus {
  const statuses = tables.map(getTableStatus);
  if (statuses.includes("critical")) return "critical";
  if (statuses.includes("stale")) return "stale";
  return "fresh";
}

function StatusIndicator({ status }: { status: FreshnessStatus }) {
  const colors = {
    fresh: "bg-green-500",
    stale: "bg-yellow-500",
    critical: "bg-red-500",
  };

  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
}

function formatRowCount(count?: number): string {
  if (count === undefined || count === null) return "?";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatLastSync(lastSyncAt?: string): string {
  if (!lastSyncAt) return "never";
  try {
    return formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true });
  } catch {
    return "unknown";
  }
}

export function SourceCard({ source }: { source: Source }) {
  const status = getSourceStatus(source.tables);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          <h3 className="text-base font-medium text-gray-900">{source.displayName}</h3>
        </div>
        <span className="text-sm text-gray-500 font-mono">{source.tables.length} tables</span>
      </div>

      <div className="space-y-2">
        {source.tables.map((table) => {
          const tableStatus = getTableStatus(table);
          return (
            <div
              key={table.name}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <StatusIndicator status={tableStatus} />
                <span className="font-mono text-gray-900">{table.name}</span>
                <span className="text-gray-500">
                  ({formatRowCount(table.rowCount)} rows)
                </span>
              </div>
              <span className="text-gray-500">
                {formatLastSync(table.lastSyncAt)}
              </span>
            </div>
          );
        })}
      </div>

      {source.dagsterJobUrl && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <a
            href={source.dagsterJobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            View in Dagster
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
