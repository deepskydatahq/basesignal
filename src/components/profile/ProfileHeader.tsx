import { getProductInitial, getProductColor } from "../../lib/productColor";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { ExportPdfButton } from "./ExportPdfButton";
import { DownloadCardButton } from "./DownloadCardButton";
import type { ProfilePdfData } from "../../lib/pdf/generateProfilePdf";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

const REVENUE_MODEL_LABELS: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier Subscription",
  seat_subscription: "Seat Subscription",
  volume_based: "Volume Based",
};

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

interface ProfileHeaderProps {
  identity: {
    productName?: string;
    productDescription?: string;
    websiteUrl?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: "b2b" | "b2c";
    revenueModels?: string[];
  };
  completeness: {
    completed: number;
    total: number;
    sections?: Section[];
  };
  stats?: {
    metricsCount: number;
    entitiesCount: number;
    activitiesCount: number;
  };
  stages?: string[];
  profileData?: ProfilePdfData;
}

export function ProfileHeader({
  identity,
  completeness,
  stats,
  stages,
  profileData,
}: ProfileHeaderProps) {
  // Derive business type badge - B2B if multi-user OR explicit b2b
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  const percentage = Math.round(
    (completeness.completed / completeness.total) * 100
  );

  const initial = getProductInitial(identity.productName);
  const backgroundColor = getProductColor(identity.productName);

  return (
    <header className="mb-8">
      <div className="flex items-start gap-4">
        {/* Logo avatar */}
        <div
          aria-label="Product avatar"
          className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold overflow-hidden"
          style={{ backgroundColor }}
        >
          {(() => {
            const domain = extractDomain(identity.websiteUrl);
            if (domain) {
              return (
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                  alt={`${identity.productName || "Product"} favicon`}
                  className="w-8 h-8"
                  onError={(e) => {
                    // Replace img with initial on error
                    const target = e.currentTarget;
                    target.style.display = "none";
                    target.parentElement!.textContent = initial;
                  }}
                />
              );
            }
            return initial;
          })()}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {identity.productName || "Your Product"}
          </h1>

          {identity.productDescription && (
            <p className="mt-1 text-gray-600">{identity.productDescription}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {/* Business model badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
            {businessTypeBadge}
          </span>
          {identity.revenueModels?.map((model) => (
            <span
              key={model}
              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {REVENUE_MODEL_LABELS[model] ?? model}
            </span>
          ))}
        </div>

        {/* Completeness indicator and actions */}
        <div className="flex items-center gap-2">
          {stats && stages && (
            <DownloadCardButton
              productName={identity.productName || "Your Product"}
              description={identity.productDescription}
              stages={stages}
              completeness={completeness}
              metricsCount={stats.metricsCount}
              entitiesCount={stats.entitiesCount}
            />
          )}
          {profileData && <ExportPdfButton profileData={profileData} />}
          {completeness.sections && completeness.sections.length > 0 ? (
            <CompletenessIndicator sections={completeness.sections} />
          ) : (
            <>
              <div
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
              >
                <div
                  data-testid="progress-bar-fill"
                  className="h-full bg-black rounded-full transition-[width] duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {stats ? (
                <span className="text-sm text-gray-600">
                  {pluralize(stats.metricsCount, "Metric", "Metrics")} · {pluralize(stats.entitiesCount, "Entity", "Entities")} · {pluralize(stats.activitiesCount, "Activity", "Activities")}
                </span>
              ) : (
                <span className="text-sm text-gray-600">
                  {completeness.completed} of {completeness.total}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
