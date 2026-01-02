import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductProfileCardProps {
  productName: string;
  role: string;
  hasMultiUserAccounts?: boolean;
  businessType?: string;
  revenueModels?: string[];
}

const roleOptions = ["Product", "Growth", "Engineering", "Founder", "Other"];

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

// Map revenue model values to display labels
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
    return "B2B \u00b7 Multi-user accounts";
  } else if (businessType === "b2c") {
    return "B2C \u00b7 Single-user accounts";
  } else if (businessType === "b2b") {
    return "B2B \u00b7 Single-user accounts";
  }
  return null;
}

function formatRevenueModels(revenueModels?: string[]): string | null {
  if (!revenueModels || revenueModels.length === 0) return null;
  return revenueModels
    .map((model) => revenueModelDisplayLabels[model] || model)
    .join(", ");
}

export function ProductProfileCard({
  productName,
  role,
  hasMultiUserAccounts,
  businessType,
  revenueModels,
}: ProductProfileCardProps) {
  const updateOnboarding = useMutation(api.users.updateOnboarding);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    productName,
    role,
    hasMultiUserAccounts: hasMultiUserAccounts ?? null,
    businessType: businessType ?? undefined,
    revenueModels: revenueModels ?? [],
  });

  const handleSave = async () => {
    await updateOnboarding({
      productName: editValues.productName,
      role: editValues.role,
      hasMultiUserAccounts: editValues.hasMultiUserAccounts ?? undefined,
      businessType:
        editValues.hasMultiUserAccounts === true
          ? undefined
          : editValues.businessType,
      revenueModels: editValues.revenueModels,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({
      productName,
      role,
      hasMultiUserAccounts: hasMultiUserAccounts ?? null,
      businessType: businessType ?? undefined,
      revenueModels: revenueModels ?? [],
    });
    setIsEditing(false);
  };

  const toggleRevenueModel = (value: string) => {
    setEditValues((prev) => ({
      ...prev,
      revenueModels: prev.revenueModels.includes(value)
        ? prev.revenueModels.filter((v) => v !== value)
        : [...prev.revenueModels, value],
    }));
  };

  // Edit mode validation
  const canSave =
    editValues.productName.trim() &&
    editValues.role &&
    editValues.hasMultiUserAccounts !== null &&
    editValues.revenueModels.length > 0 &&
    (editValues.hasMultiUserAccounts === true ||
      editValues.businessType !== undefined);

  if (isEditing) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
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

          {/* Role */}
          <div className="space-y-2">
            <Label>Your Role</Label>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((r) => (
                <button
                  key={r}
                  onClick={() => setEditValues({ ...editValues, role: r })}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    editValues.role === r
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Multi-user accounts */}
          <div className="space-y-2">
            <Label>Can an account have multiple users?</Label>
            <div className="flex flex-wrap gap-2">
              {multiUserOptions.map((option) => (
                <button
                  key={String(option.value)}
                  onClick={() => {
                    setEditValues((prev) => ({
                      ...prev,
                      hasMultiUserAccounts: option.value,
                      // Clear businessType if switching to multi-user
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
                    onCheckedChange={() => toggleRevenueModel(option.value)}
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
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  const businessLine = formatBusinessLine(hasMultiUserAccounts, businessType);
  const revenueLine = formatRevenueModels(revenueModels);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">{productName}</h1>
          <div className="mt-1 text-sm text-gray-500">
            {businessLine && <p>{businessLine}</p>}
            {revenueLine && <p>{revenueLine}</p>}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Role: <span className="text-gray-700">{role}</span>
          </p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
