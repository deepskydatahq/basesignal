interface ProfileHeaderProps {
  identity: {
    productName?: string;
    productDescription?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: "b2b" | "b2c";
    revenueModels?: string[];
  };
  completeness: {
    completed: number;
    total: number;
  };
}

export function ProfileHeader({ identity }: ProfileHeaderProps) {
  // Derive business type badge - B2B if multi-user OR explicit b2b
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>

      {identity.productDescription && (
        <p className="mt-1 text-gray-600">{identity.productDescription}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        {/* Business model badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
            {businessTypeBadge}
          </span>
        </div>
      </div>
    </header>
  );
}
