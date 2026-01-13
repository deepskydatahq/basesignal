import { useState } from "react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";

export interface TrackingMaturityData {
  trackingStatus: string;
  trackingPainPoint: string;
  trackingPainPointOther: string | undefined;
  analyticsTools: string[];
}

interface Props {
  initialData?: Partial<TrackingMaturityData>;
  onNext: (data: TrackingMaturityData) => void;
  onBack: () => void;
}

const trackingStatusOptions = [
  { label: "Yes, fully implemented", value: "full" },
  { label: "Yes, but incomplete/messy", value: "partial" },
  { label: "Just started / minimal", value: "minimal" },
  { label: "No, starting from scratch", value: "none" },
];

const painPointOptions = [
  { label: "I don't know what to track", value: "what_to_track" },
  { label: "My tracking is inconsistent/broken", value: "inconsistent" },
  { label: "I have data but can't connect it to business outcomes", value: "no_outcomes" },
  { label: "Stakeholders don't trust the data", value: "trust" },
  { label: "Other", value: "other" },
];

const analyticsToolOptions = [
  { label: "Amplitude", value: "amplitude" },
  { label: "Mixpanel", value: "mixpanel" },
  { label: "Google Analytics 4", value: "ga4" },
  { label: "Heap", value: "heap" },
  { label: "PostHog", value: "posthog" },
  { label: "Segment", value: "segment" },
  { label: "Rudderstack", value: "rudderstack" },
  { label: "Snowplow", value: "snowplow" },
  { label: "Custom / In-house", value: "custom" },
  { label: "None", value: "none" },
];

export function TrackingMaturityScreen({ initialData, onNext, onBack }: Props) {
  const [trackingStatus, setTrackingStatus] = useState<string | null>(
    initialData?.trackingStatus ?? null
  );
  const [trackingPainPoint, setTrackingPainPoint] = useState<string | null>(
    initialData?.trackingPainPoint ?? null
  );
  const [trackingPainPointOther, setTrackingPainPointOther] = useState(
    initialData?.trackingPainPointOther ?? ""
  );
  const [analyticsTools, setAnalyticsTools] = useState<string[]>(
    initialData?.analyticsTools ?? []
  );

  const toggleTool = (value: string) => {
    setAnalyticsTools((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  // Validation
  const hasTrackingStatus = trackingStatus !== null;
  const hasPainPoint = trackingPainPoint !== null;
  const hasPainPointOther =
    trackingPainPoint !== "other" || trackingPainPointOther.trim().length > 0;
  const hasTools = analyticsTools.length > 0;

  const canContinue = hasTrackingStatus && hasPainPoint && hasPainPointOther && hasTools;

  const handleContinue = () => {
    if (!canContinue || !trackingStatus || !trackingPainPoint) return;
    onNext({
      trackingStatus,
      trackingPainPoint,
      trackingPainPointOther:
        trackingPainPoint === "other" ? trackingPainPointOther.trim() : undefined,
      analyticsTools,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-medium">Tell us about your current tracking</h1>
        <p className="text-gray-600">
          This helps us personalize your Basesignal experience.
        </p>
      </div>

      <div className="space-y-5">
        {/* Question 1: Tracking status */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
        >
          <Label>Do you have a tracking setup?</Label>
          <div className="grid grid-cols-2 gap-2">
            {trackingStatusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTrackingStatus(option.value)}
                className={`px-3 py-2 rounded-md text-sm border transition-colors text-left ${
                  trackingStatus === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2: Pain point */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
        >
          <Label>What's your biggest tracking challenge?</Label>
          <div className="space-y-2">
            {painPointOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTrackingPainPoint(option.value)}
                className={`w-full px-3 py-2 rounded-md text-sm border transition-colors text-left ${
                  trackingPainPoint === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Other text input */}
          {trackingPainPoint === "other" && (
            <div
              className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <Input
                placeholder="Describe your challenge..."
                value={trackingPainPointOther}
                onChange={(e) => setTrackingPainPointOther(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Question 3: Analytics tools */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <Label>What analytics tools do you use? (select all that apply)</Label>
          <div className="grid grid-cols-2 gap-2">
            {analyticsToolOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`tool-${option.value}`}
                  checked={analyticsTools.includes(option.value)}
                  onCheckedChange={() => toggleTool(option.value)}
                  aria-label={option.label}
                />
                <label
                  htmlFor={`tool-${option.value}`}
                  className="text-sm text-gray-700 cursor-pointer select-none"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={handleContinue} className="flex-1" disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
