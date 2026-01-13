import { ProfileSection } from "./ProfileSection";

interface FutureSectionCardProps {
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
}

export function FutureSectionCard({
  title,
  description,
  prerequisite,
  isReady,
}: FutureSectionCardProps) {
  return (
    <ProfileSection
      title={title}
      status={isReady ? "not_started" : "locked"}
      statusLabel="Not Defined"
      actionLabel="Start Interview"
      prerequisiteText={!isReady ? prerequisite : undefined}
    >
      <p className="text-sm text-gray-500">{description}</p>
    </ProfileSection>
  );
}
