import { Card } from "@/components/ui/card";
import type { ActivationMap, ActivationStage, StageTransition } from "./types";

const SIGNAL_COLORS: Record<string, string> = {
  very_strong: "bg-indigo-100 text-indigo-800",
  strong: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  weak: "bg-gray-100 text-gray-800",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

function normalizeDropOffRisk(risk: unknown): string {
  if (typeof risk === "string") return risk;
  if (risk && typeof risk === "object" && "level" in risk) {
    return String((risk as { level: string }).level);
  }
  return "medium";
}

function StageCard({
  stage,
  isPrimary,
}: {
  stage: ActivationStage;
  isPrimary: boolean;
}) {
  const risk = normalizeDropOffRisk(stage.drop_off_risk);

  return (
    <div
      data-testid="stage-card"
      className={`min-w-[240px] shrink-0 rounded-lg border border-gray-200 bg-white p-4 ${
        isPrimary ? "ring-2 ring-indigo-500 bg-indigo-50" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-500">
            L{stage.level}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {stage.name}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            SIGNAL_COLORS[stage.signal_strength] ?? SIGNAL_COLORS.medium
          }`}
        >
          {stage.signal_strength}
        </span>
      </div>

      <div className="mb-2">
        <p className="text-xs font-medium text-gray-500">Triggers</p>
        <ul className="text-sm text-gray-700">
          {stage.trigger_events.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>

      <div className="mb-2">
        <p className="text-xs font-medium text-gray-500">Value Moments</p>
        <ul className="text-sm text-gray-700">
          {stage.value_moments_unlocked.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-gray-500">Drop-off:</p>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            RISK_COLORS[risk] ?? RISK_COLORS.medium
          }`}
        >
          {risk}
        </span>
      </div>
    </div>
  );
}

function TransitionConnector({
  transition,
}: {
  transition: StageTransition;
}) {
  return (
    <div
      data-testid="transition-connector"
      className="flex shrink-0 flex-col items-center justify-center px-2 text-center"
    >
      <span className="text-gray-400">&rarr;</span>
      {transition.trigger_events.map((e) => (
        <span key={e} className="text-xs text-gray-600">
          {e}
        </span>
      ))}
      {transition.typical_timeframe && (
        <span className="text-xs text-gray-400">
          {transition.typical_timeframe}
        </span>
      )}
    </div>
  );
}

export function ActivationMapSection({
  activationMap,
}: {
  activationMap: ActivationMap | null | undefined;
}) {
  if (!activationMap) {
    return (
      <Card>
        <p className="text-sm text-gray-500">
          No activation map available yet.
        </p>
      </Card>
    );
  }

  const sorted = [...activationMap.stages].sort((a, b) => a.level - b.level);

  return (
    <Card>
      <h3 className="mb-4 text-base font-medium text-gray-900">
        Activation Map
      </h3>
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {sorted.map((stage, i) => {
          const transition = activationMap.transitions.find(
            (t) =>
              t.from_level === stage.level &&
              sorted[i + 1] &&
              t.to_level === sorted[i + 1].level
          );

          return (
            <div key={stage.level} className="flex items-start">
              <StageCard
                stage={stage}
                isPrimary={
                  stage.level === activationMap.primary_activation_level
                }
              />
              {transition && <TransitionConnector transition={transition} />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
