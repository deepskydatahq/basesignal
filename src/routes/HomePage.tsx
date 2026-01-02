import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductProfileCard } from "../components/home/ProductProfileCard";
import { JourneyRoadmap } from "../components/home/JourneyRoadmap";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const user = useQuery(api.users.current);
  const defaults = useQuery(api.journeys.getDefaultsByType);

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

      {/* Journey Roadmap or Empty State */}
      {defaults && Object.values(defaults).some((j) => j !== null) ? (
        <JourneyRoadmap defaults={defaults} />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <h2 className="text-base font-medium text-gray-900">No journey yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Create your first journey to start mapping how {user.userTerminology ?? "users"} find value.
          </p>
          <Link to="/journeys">
            <Button className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Create Journey
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
