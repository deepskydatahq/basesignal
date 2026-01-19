import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface SuggestedNextActionProps {
  nextSection: "journey_map" | "metric_catalog" | "measurement_plan" | null;
  lastCompleted: string | null;
}

export function SuggestedNextAction({
  nextSection,
  lastCompleted,
}: SuggestedNextActionProps) {
  const navigate = useNavigate();

  if (!nextSection) return null;

  // Inline the 3 cases - no abstraction needed
  let heading: string;
  let description: string;
  let buttonLabel: string;
  let route: string;

  if (nextSection === "journey_map") {
    heading =
      lastCompleted === "core_identity"
        ? "Now let's map your user journey"
        : "Map your user journey";
    description =
      "A 10-minute conversation to identify your product's key lifecycle moments.";
    buttonLabel = "Start Overview Interview";
    route = "/setup/interview";
  } else if (nextSection === "metric_catalog") {
    heading =
      lastCompleted === "first_value"
        ? "Turn your first value moment into metrics"
        : "Generate your metric catalog";
    description =
      "Create a complete set of product metrics based on your journey.";
    buttonLabel = "Generate Metrics";
    route = "/metric-catalog";
  } else {
    heading = "Connect metrics to your data";
    description = "Map your metrics to events from your analytics platform.";
    buttonLabel = "Build Measurement Plan";
    route = "/measurement-plan";
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
      <h3 className="font-semibold text-gray-900">{heading}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <Button onClick={() => navigate(route)} className="mt-3" size="sm">
        {buttonLabel}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
