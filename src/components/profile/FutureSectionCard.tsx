import { ProfileSection } from "./ProfileSection";

interface FutureSectionCardProps {
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
  timeEstimate?: string;
}

export function FutureSectionCard({
  title,
  description,
  prerequisite,
  isReady,
  timeEstimate,
}: FutureSectionCardProps) {
  const actionLabel = isReady && timeEstimate
    ? `Start Interview  ${timeEstimate}`
    : "Start Interview";

  return (
    <ProfileSection
      title={title}
      status={isReady ? "not_started" : "locked"}
      statusLabel="Not Defined"
      actionLabel={actionLabel}
      prerequisiteText={!isReady ? prerequisite : undefined}
    >
      <p className="text-sm text-gray-500">{description}</p>
    </ProfileSection>
  );
}
