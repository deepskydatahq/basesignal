import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { StageCard, type StageStatus } from "./StageCard";
import type { Id } from "../../../convex/_generated/dataModel";

interface FoundationStatus {
  overviewInterview: {
    status: "not_started" | "in_progress" | "complete";
    journeyId: Id<"journeys"> | null;
    slotsCompleted: number;
    slotsTotal: number;
  };
  firstValue: {
    status: "defined" | "not_defined";
    journeyId: Id<"journeys"> | null;
  };
  measurementPlan: { status: "locked" };
  metricCatalog: {
    status: "locked" | "in_progress" | "complete";
    metricsCount: number;
  };
}

interface MeasurementFoundationCardProps {
  status: FoundationStatus;
}

export function MeasurementFoundationCard({ status }: MeasurementFoundationCardProps) {
  const navigate = useNavigate();

  const handleOverviewClick = () => {
    if (status.overviewInterview.status === "complete" && status.overviewInterview.journeyId) {
      navigate(`/journeys/${status.overviewInterview.journeyId}`);
    } else {
      navigate("/setup/interview");
    }
  };

  const handleFirstValueClick = () => {
    if (status.firstValue.status === "defined" && status.firstValue.journeyId) {
      navigate(`/journeys/${status.firstValue.journeyId}`);
    } else {
      navigate("/interviews/first_value");
    }
  };

  const handleMetricCatalogClick = () => {
    navigate("/metric-catalog");
  };

  // Map overview status to StageStatus
  const overviewStageStatus: StageStatus = status.overviewInterview.status;

  // Map firstValue status to StageStatus
  const firstValueStageStatus: StageStatus = status.firstValue.status;

  // Map metricCatalog status to StageStatus
  const metricCatalogStageStatus: StageStatus = status.metricCatalog.status;

  // Generate badge text for metric catalog
  const metricCatalogBadgeText =
    status.metricCatalog.metricsCount > 0
      ? `${status.metricCatalog.metricsCount} metrics`
      : undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-medium text-gray-500">Measurement Foundation</h2>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StageCard
          title="Overview Interview"
          description="Map your product's user lifecycle"
          icon="Users"
          status={overviewStageStatus}
          progressText={
            status.overviewInterview.status === "in_progress"
              ? `${status.overviewInterview.slotsCompleted} of ${status.overviewInterview.slotsTotal} lifecycle slots`
              : undefined
          }
          onClick={handleOverviewClick}
        />

        <StageCard
          title="First Value"
          description="Define when users find value"
          icon="Target"
          status={firstValueStageStatus}
          onClick={handleFirstValueClick}
        />

        <StageCard
          title="Measurement Plan"
          description="Connect your analytics data"
          icon="FileText"
          status="locked"
        />

        <StageCard
          title="Metric Catalog"
          description="Generate your product metrics"
          icon="BarChart3"
          status={metricCatalogStageStatus}
          badgeText={metricCatalogBadgeText}
          onClick={status.metricCatalog.status !== "locked" ? handleMetricCatalogClick : undefined}
        />
      </div>
    </div>
  );
}
