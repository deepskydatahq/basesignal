import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  MeasurementSpec,
  TrackingEvent,
  MapsTo,
} from "../../../convex/analysis/outputs/types";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  activation: { bg: "bg-indigo-100", text: "text-indigo-700" },
  value: { bg: "bg-emerald-100", text: "text-emerald-700" },
  retention: { bg: "bg-amber-100", text: "text-amber-700" },
  expansion: { bg: "bg-purple-100", text: "text-purple-700" },
};

const DEFAULT_COLOR = { bg: "bg-gray-100", text: "text-gray-700" };

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

function formatMapsTo(mapsTo: MapsTo): string {
  switch (mapsTo.type) {
    case "value_moment":
      return "Value Moment";
    case "activation_level":
      return `Activation L${mapsTo.activation_level}`;
    case "both":
      return `Both (L${mapsTo.activation_level})`;
  }
}

function groupEventsByCategory(
  events: TrackingEvent[]
): Record<string, TrackingEvent[]> {
  return events.reduce<Record<string, TrackingEvent[]>>((acc, event) => {
    const cat = event.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(event);
    return acc;
  }, {});
}

interface EventRowProps {
  event: TrackingEvent;
}

function EventRow({ event }: EventRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
        >
          <span className="font-medium text-gray-900">{event.name}</span>
          <span className="text-gray-600 truncate">{event.description}</span>
          <span className="text-gray-500 truncate">
            {event.trigger_condition}
          </span>
          <Badge variant="outline" className="text-xs whitespace-nowrap">
            {formatMapsTo(event.maps_to)}
          </Badge>
          <ChevronRight
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {event.properties.length > 0 ? (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.properties.map((prop) => (
                  <TableRow key={prop.name}>
                    <TableCell className="font-mono text-xs">
                      {prop.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {prop.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {prop.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
            No properties defined
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface MeasurementSpecSectionProps {
  measurementSpec: MeasurementSpec | null | undefined;
}

export function MeasurementSpecSection({
  measurementSpec,
}: MeasurementSpecSectionProps) {
  if (!measurementSpec) {
    return (
      <div data-testid="measurement-spec-empty">
        <p className="font-medium text-gray-900">
          No measurement spec available yet.
        </p>
        <p className="text-gray-600 text-sm mt-1">
          Generate a measurement spec to see tracking events and their
          properties.
        </p>
      </div>
    );
  }

  const grouped = groupEventsByCategory(measurementSpec.events);
  const categories = Object.keys(grouped);

  return (
    <div data-testid="measurement-spec-section">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-sm font-medium text-gray-700">
          {measurementSpec.total_events} events
        </span>
        <span className="text-sm text-gray-500">
          {Math.round(measurementSpec.confidence * 100)}% confidence
        </span>
        {categories.map((cat) => {
          const color = getCategoryColor(cat);
          return (
            <Badge
              key={cat}
              className={`${color.bg} ${color.text} border-0`}
            >
              {cat} ({grouped[cat].length})
            </Badge>
          );
        })}
      </div>

      {/* Category sections */}
      {categories.map((cat) => {
        const events = grouped[cat];
        const color = getCategoryColor(cat);
        return (
          <div key={cat} className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900 capitalize">
                {cat}
              </h3>
              <Badge className={`${color.bg} ${color.text} border-0 text-xs`}>
                {events.length}
              </Badge>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                <span>Event</span>
                <span>Description</span>
                <span>Trigger</span>
                <span>Maps To</span>
                <span className="w-4" />
              </div>
              {events.map((event) => (
                <EventRow key={event.name} event={event} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
