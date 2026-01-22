import { ProfileSection } from "./ProfileSection";

interface FutureSectionCardProps {
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
  timeEstimate?: string;
  onAction?: () => void;
}

export function FutureSectionCard({
  title,
  description,
  prerequisite,
  isReady,
  timeEstimate,
  onAction,
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
      onAction={isReady ? onAction : undefined}
      prerequisiteText={!isReady ? prerequisite : undefined}
      timeEstimate={isReady ? timeEstimate : undefined}
    >
      <p className="text-sm text-gray-500">{description}</p>
    </ProfileSection>
  );
}
