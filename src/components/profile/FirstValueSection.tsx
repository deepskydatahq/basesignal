import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ProfileSection } from "./ProfileSection";
import { Button } from "@/components/ui/button";

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);

  return (
    <ProfileSection
      title="First Value Moment"
      status="not_started"
      statusLabel="Not Started"
      actionLabel="Define"
      onAction={() => {}}
    >
      <p className="text-gray-500 italic">
        Define the moment when users first experience value from your product.
      </p>
    </ProfileSection>
  );
}
