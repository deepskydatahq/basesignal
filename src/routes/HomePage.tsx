import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductProfileCard } from "../components/home/ProductProfileCard";
import { MeasurementFoundationCard } from "../components/home/MeasurementFoundationCard";

export default function HomePage() {
  const user = useQuery(api.users.current);
  const foundationStatus = useQuery(api.setupProgress.foundationStatus);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Product Profile Card */}
      <ProductProfileCard
        productName={user.productName ?? "Your Product"}
        role={user.role ?? "Product Manager"}
        hasMultiUserAccounts={user.hasMultiUserAccounts}
        businessType={user.businessType}
        revenueModels={user.revenueModels}
      />

      {/* Measurement Foundation Card */}
      {foundationStatus && (
        <MeasurementFoundationCard status={foundationStatus} />
      )}
    </div>
  );
}
