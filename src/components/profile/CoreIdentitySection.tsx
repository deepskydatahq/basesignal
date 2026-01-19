import { useState, useEffect } from "react";
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

const multiUserOptions = [
  { label: "No", value: false },
  { label: "Yes", value: true },
];

const businessTypeOptions = [
  { label: "B2C", value: "b2c" },
  { label: "B2B", value: "b2b" },
];

const revenueModelOptions = [
  { label: "One-time transactions", value: "transactions" },
  { label: "Tier subscription", value: "tier_subscription" },
  { label: "Seat-based subscription", value: "seat_subscription" },
  { label: "Usage/credit-based", value: "volume_based" },
];

function toggleRevenueModel(
  currentModels: string[],
  value: string
): string[] {
  return currentModels.includes(value)
    ? currentModels.filter((v) => v !== value)
    : [...currentModels, value];
}

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
  const updateOnboarding = useMutation(api.users.updateOnboarding);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    productName: data.productName ?? "",
    websiteUrl: data.websiteUrl ?? "",
    hasMultiUserAccounts: data.hasMultiUserAccounts ?? null,
    businessType: data.businessType ?? undefined,
    revenueModels: data.revenueModels ?? [],
  });

  const handleSave = async () => {
    await updateOnboarding({
      productName: editValues.productName || undefined,
      websiteUrl: editValues.websiteUrl || undefined,
      hasMultiUserAccounts: editValues.hasMultiUserAccounts ?? undefined,
      businessType:
        editValues.hasMultiUserAccounts === true
          ? undefined
          : editValues.businessType,
      revenueModels:
        editValues.revenueModels.length > 0
          ? editValues.revenueModels
          : undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({
      productName: data.productName ?? "",
      websiteUrl: data.websiteUrl ?? "",
      hasMultiUserAccounts: data.hasMultiUserAccounts ?? null,
      businessType: data.businessType ?? undefined,
      revenueModels: data.revenueModels ?? [],
    });
    setIsEditing(false);
  };

  // Sync editValues when data prop changes
  useEffect(() => {
    setEditValues({
      productName: data.productName ?? "",
      websiteUrl: data.websiteUrl ?? "",
      hasMultiUserAccounts: data.hasMultiUserAccounts ?? null,
      businessType: data.businessType ?? undefined,
      revenueModels: data.revenueModels ?? [],
    });
  }, [
    data.productName,
    data.websiteUrl,
    data.hasMultiUserAccounts,
    data.businessType,
    data.revenueModels,
  ]);

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

          {/* Multi-user accounts */}
          <div className="space-y-2">
            <Label>Can an account have multiple users?</Label>
            <div className="flex flex-wrap gap-2">
              {multiUserOptions.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    setEditValues((prev) => ({
                      ...prev,
                      hasMultiUserAccounts: option.value,
                      businessType:
                        option.value === true ? undefined : prev.businessType,
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    editValues.hasMultiUserAccounts === option.value
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* B2C/B2B (conditional) */}
          <div
            className={`space-y-2 overflow-hidden transition-all duration-300 ease-in-out ${
              editValues.hasMultiUserAccounts === false
                ? "max-h-24 opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <Label>B2C or B2B?</Label>
            <div className="flex flex-wrap gap-2">
              {businessTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setEditValues({ ...editValues, businessType: option.value })
                  }
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    editValues.businessType === option.value
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue Models */}
          <div className="space-y-2">
            <Label>Revenue Models</Label>
            <div className="space-y-2">
              {revenueModelOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`revenue-${option.value}`}
                    checked={editValues.revenueModels.includes(option.value)}
                    onCheckedChange={() =>
                      setEditValues((prev) => ({
                        ...prev,
                        revenueModels: toggleRevenueModel(
                          prev.revenueModels,
                          option.value
                        ),
                      }))
                    }
                  />
                  <label
                    htmlFor={`revenue-${option.value}`}
                    className="text-sm text-gray-700 cursor-pointer select-none"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check className="w-4 h-4 mr-1" />
              Save
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
            <div>
              <p className="font-medium text-gray-900">Your product's P&L starts here.</p>
              <p className="text-gray-600 text-sm mt-1">
                How you monetize and who you serve determines which metrics matter most.
              </p>
            </div>
          )}
      </div>
    </ProfileSection>
  );
}
