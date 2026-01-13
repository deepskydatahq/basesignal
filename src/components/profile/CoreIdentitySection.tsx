import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Check, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ProfileSection } from "./ProfileSection";

export interface CoreIdentityData {
  productName?: string;
  websiteUrl?: string;
  hasMultiUserAccounts?: boolean;
  businessType?: string;
  revenueModels?: string[];
}

interface CoreIdentitySectionProps {
  data: CoreIdentityData;
}

const revenueModelDisplayLabels: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier subscription",
  seat_subscription: "Seat-based",
  volume_based: "Usage-based",
};

function formatBusinessLine(
  hasMultiUserAccounts?: boolean,
  businessType?: string
): string | null {
  if (hasMultiUserAccounts === undefined) return null;

  if (hasMultiUserAccounts) {
    return "B2B · Multi-user accounts";
  } else if (businessType === "b2c") {
    return "B2C · Single-user accounts";
  } else if (businessType === "b2b") {
    return "B2B · Single-user accounts";
  }
  return null;
}

function formatRevenueModels(revenueModels?: string[]): string | null {
  if (!revenueModels || revenueModels.length === 0) return null;
  return revenueModels
    .map((model) => revenueModelDisplayLabels[model] || model)
    .join(", ");
}

export function CoreIdentitySection({ data }: CoreIdentitySectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    productName: data.productName ?? "",
    websiteUrl: data.websiteUrl ?? "",
    hasMultiUserAccounts: data.hasMultiUserAccounts ?? null,
    businessType: data.businessType ?? undefined,
    revenueModels: data.revenueModels ?? [],
  });

  const isComplete = Boolean(data.productName);
  const businessLine = formatBusinessLine(
    data.hasMultiUserAccounts,
    data.businessType
  );
  const revenueLine = formatRevenueModels(data.revenueModels);

  if (isEditing) {
    return (
      <ProfileSection
        title="Core Identity"
        status={isComplete ? "complete" : "not_started"}
        statusLabel={isComplete ? "Complete" : "Not Started"}
      >
        <div className="space-y-5">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="productName">Product Name</Label>
            <Input
              id="productName"
              placeholder="e.g., Acme App"
              value={editValues.productName}
              onChange={(e) =>
                setEditValues({ ...editValues, productName: e.target.value })
              }
            />
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              placeholder="https://example.com"
              value={editValues.websiteUrl}
              onChange={(e) =>
                setEditValues({ ...editValues, websiteUrl: e.target.value })
              }
            />
          </div>

          {/* Actions placeholder - will be added in next task */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      title="Core Identity"
      status={isComplete ? "complete" : "not_started"}
      statusLabel={isComplete ? "Complete" : "Not Started"}
      actionLabel="Edit"
      onAction={() => setIsEditing(true)}
    >
      <div className="space-y-3">
        {data.productName && (
          <div>
            <span className="text-sm text-gray-500">Product</span>
            <p className="text-gray-900 font-medium">{data.productName}</p>
          </div>
        )}

        {data.websiteUrl && (
          <div>
            <span className="text-sm text-gray-500">Website</span>
            <p>
              <a
                href={data.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {data.websiteUrl}
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        )}

        {businessLine && (
          <div>
            <span className="text-sm text-gray-500">Business Model</span>
            <p className="text-gray-900">{businessLine}</p>
          </div>
        )}

        {revenueLine && (
          <div>
            <span className="text-sm text-gray-500">Revenue Models</span>
            <p className="text-gray-900">{revenueLine}</p>
          </div>
        )}

        {!data.productName &&
          !data.websiteUrl &&
          !businessLine &&
          !revenueLine && (
            <p className="text-gray-400 italic">No profile information yet</p>
          )}
      </div>
    </ProfileSection>
  );
}
