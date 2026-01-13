import { useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";

export function ProfilePage() {
  const profileData = useQuery(api.profile.getProfileData);

  // Loading state
  if (profileData === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse text-gray-500">Loading profile...</div>
      </div>
    );
  }

  // Not authenticated
  if (profileData === null) {
    return <Navigate to="/sign-in" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header with completeness */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {profileData.identity.productName || "Your Product"}
        </h1>
        <div className="mt-2 text-sm text-gray-500">
          {profileData.completeness.completed}/{profileData.completeness.total}
        </div>
      </div>

      {/* Section placeholders - each will be a separate component in future issues */}
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Core Identity Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Journey Map Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">First Value Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Metric Catalog Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Measurement Plan Section</div>
        </div>
      </div>
    </div>
  );
}
