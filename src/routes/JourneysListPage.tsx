import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Star, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { JOURNEY_TYPES } from "../../convex/journeys";

// Type labels for display
const TYPE_LABELS: Record<(typeof JOURNEY_TYPES)[number], string> = {
  overview: "Overview",
  first_value: "First Value",
  retention: "Retention",
  value_outcomes: "Value Outcomes",
  value_capture: "Value Capture",
  churn: "Churn",
};

// Helper for smart default name
const getDefaultName = (typeLabel: string) => {
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `${typeLabel} - ${date}`;
};

export default function JourneysListPage() {
  const user = useQuery(api.users.current);
  const journeys = useQuery(api.journeys.listByUser);

  if (!user || !journeys) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  const productName = user.productName ?? "Your Product";

  // Group journeys by type
  const journeysByType: Record<
    (typeof JOURNEY_TYPES)[number],
    typeof journeys
  > = {
    overview: [],
    first_value: [],
    retention: [],
    value_outcomes: [],
    value_capture: [],
    churn: [],
  };

  for (const journey of journeys) {
    if (journey.type && journeysByType[journey.type as keyof typeof journeysByType]) {
      journeysByType[journey.type as keyof typeof journeysByType].push(journey);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-lg font-medium text-gray-900">
        Journeys for {productName}
      </h1>

      <div className="space-y-6">
        {JOURNEY_TYPES.map((type) => (
          <JourneyTypeSection
            key={type}
            type={type}
            label={TYPE_LABELS[type]}
            journeys={journeysByType[type]}
          />
        ))}
      </div>
    </div>
  );
}

function JourneyTypeSection({
  type,
  label,
  journeys,
}: {
  type: (typeof JOURNEY_TYPES)[number];
  label: string;
  journeys: Array<{
    _id: Id<"journeys">;
    name: string;
    isDefault?: boolean;
    updatedAt: number;
  }>;
}) {
  const navigate = useNavigate();
  const createJourney = useMutation(api.journeys.create);
  const setDefault = useMutation(api.journeys.setDefault);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleStartCreate = () => {
    setNewName(getDefaultName(label));
    setIsCreating(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const journeyId = await createJourney({ type, name: newName.trim() });
    setNewName("");
    setIsCreating(false);
    navigate(`/journeys/${journeyId}`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-base font-medium text-gray-900 mb-4">{label}</h2>

      {journeys.length === 0 && !isCreating ? (
        <div className="text-sm text-gray-500 mb-4">No journeys yet</div>
      ) : (
        <div className="space-y-3 mb-4">
          {journeys.map((journey) => (
            <JourneyRow
              key={journey._id}
              journey={journey}
              onSetDefault={() => setDefault({ id: journey._id })}
            />
          ))}
        </div>
      )}

      {isCreating ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Journey name"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
          />
          <Button size="sm" onClick={handleCreate}>
            Create
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreating(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          onClick={handleStartCreate}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <Plus className="w-4 h-4" />
          New {label} journey
        </button>
      )}
    </div>
  );
}

function JourneyRow({
  journey,
  onSetDefault,
}: {
  journey: {
    _id: Id<"journeys">;
    name: string;
    isDefault?: boolean;
    updatedAt: number;
  };
  onSetDefault: () => void;
}) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <button
          onClick={onSetDefault}
          className={`p-1 transition-opacity ${
            journey.isDefault
              ? "text-yellow-500"
              : "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-yellow-500"
          }`}
          title={journey.isDefault ? "Default journey" : "Set as default"}
        >
          <Star
            className={`w-4 h-4 ${journey.isDefault ? "fill-current" : ""}`}
          />
        </button>
        <span className="text-sm font-medium text-gray-900">{journey.name}</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          Updated {formatDistanceToNow(journey.updatedAt, { addSuffix: true })}
        </span>
        <Link
          to={`/journeys/${journey._id}`}
          className="text-sm font-medium text-gray-900 hover:text-gray-600"
        >
          Edit journey &rarr;
        </Link>
      </div>
    </div>
  );
}
