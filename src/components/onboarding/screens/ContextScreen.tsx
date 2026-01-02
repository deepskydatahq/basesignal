import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Checkbox } from "../../ui/checkbox";

interface ContextData {
  productName: string;
  role: string;
  hasMultiUserAccounts: boolean;
  businessType: string | undefined;
  revenueModels: string[];
}

interface Props {
  onNext: (data: ContextData) => void;
}

const roleOptions = ["Product", "Growth", "Engineering", "Founder", "Other"];

const multiUserOptions = [
  { label: "No, each user is their own account", value: false },
  { label: "Yes, accounts have multiple users", value: true },
];

const businessTypeOptions = [
  { label: "B2C - consumers", value: "b2c" },
  { label: "B2B - businesses", value: "b2b" },
];

const revenueModelOptions = [
  { label: "One-time transactions", value: "transactions" },
  { label: "Tier subscription (Free/Pro/Enterprise)", value: "tier_subscription" },
  { label: "Seat-based subscription (per user)", value: "seat_subscription" },
  { label: "Usage/credit-based", value: "volume_based" },
];

export function ContextScreen({ onNext }: Props) {
  const [productName, setProductName] = useState("");
  const [role, setRole] = useState("");
  const [hasMultiUserAccounts, setHasMultiUserAccounts] = useState<boolean | null>(null);
  const [businessType, setBusinessType] = useState<string | undefined>(undefined);
  const [revenueModels, setRevenueModels] = useState<string[]>([]);

  const toggleRevenueModel = (value: string) => {
    setRevenueModels((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  // Validation logic
  const baseRequirements =
    productName.trim() &&
    role &&
    hasMultiUserAccounts !== null &&
    revenueModels.length > 0;

  // If hasMultiUserAccounts is false, also require businessType
  const canContinue =
    baseRequirements && (hasMultiUserAccounts === true || businessType !== undefined);

  const handleContinue = () => {
    if (!canContinue || hasMultiUserAccounts === null) return;
    onNext({
      productName: productName.trim(),
      role,
      hasMultiUserAccounts,
      businessType: hasMultiUserAccounts ? undefined : businessType,
      revenueModels,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-medium">Before we map what matters</h1>
        <p className="text-gray-600">
          Our AI interviewer will ask about your product journey. First, a few quick questions.
        </p>
      </div>

      <div className="space-y-5">
        {/* Question 1: Product name */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
        >
          <Label htmlFor="productName">What's your product called?</Label>
          <Input
            id="productName"
            placeholder="e.g., Acme App"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </div>

        {/* Question 2: Role */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "75ms", animationFillMode: "backwards" }}
        >
          <Label>What's your role?</Label>
          <div className="flex flex-wrap gap-2">
            {roleOptions.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  role === r
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Question 3: Multi-user accounts */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
        >
          <Label>Can an account have multiple users?</Label>
          <div className="flex flex-wrap gap-2">
            {multiUserOptions.map((option) => (
              <button
                key={String(option.value)}
                onClick={() => {
                  setHasMultiUserAccounts(option.value);
                  // Clear businessType if switching to multi-user
                  if (option.value === true) {
                    setBusinessType(undefined);
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  hasMultiUserAccounts === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question 4: B2C/B2B (conditional) */}
        <div
          className={`space-y-2 overflow-hidden transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-bottom-2 ${
            hasMultiUserAccounts === false
              ? "max-h-24 opacity-100"
              : "max-h-0 opacity-0"
          }`}
          style={{ animationDelay: "225ms", animationFillMode: "backwards" }}
        >
          <Label>Is this a B2C or B2B product?</Label>
          <div className="flex flex-wrap gap-2">
            {businessTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setBusinessType(option.value)}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  businessType === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question 5: Revenue models (multi-select) */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
        >
          <Label>How do you monetize?</Label>
          <div className="space-y-2">
            {revenueModelOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`revenue-${option.value}`}
                  checked={revenueModels.includes(option.value)}
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
      </div>

      <Button onClick={handleContinue} className="w-full" disabled={!canContinue}>
        Continue
      </Button>
    </div>
  );
}
