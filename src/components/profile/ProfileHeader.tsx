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
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>

      {identity.productDescription && (
        <p className="mt-1 text-gray-600">{identity.productDescription}</p>
      )}
    </header>
  );
}
