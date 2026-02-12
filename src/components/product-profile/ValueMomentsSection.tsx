import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ValueMoment, ValueMomentTier } from "./types";

interface ValueMomentsSectionProps {
  moments: ValueMoment[];
}

const tierConfig: Record<
  ValueMomentTier,
  { label: string; borderColor: string; badgeClass: string; headingColor: string }
> = {
  1: {
    label: "Core",
    borderColor: "border-indigo-200",
    badgeClass: "bg-indigo-100 text-indigo-700",
    headingColor: "text-indigo-900",
  },
  2: {
    label: "Important",
    borderColor: "border-amber-200",
    badgeClass: "bg-amber-100 text-amber-700",
    headingColor: "text-amber-900",
  },
  3: {
    label: "Supporting",
    borderColor: "border-gray-200",
    badgeClass: "bg-gray-100 text-gray-700",
    headingColor: "text-gray-700",
  },
};

function StatsBar({ moments }: { moments: ValueMoment[] }) {
  const total = moments.length;
  const tier1 = moments.filter((m) => m.tier === 1).length;
  const tier2 = moments.filter((m) => m.tier === 2).length;
  const tier3 = moments.filter((m) => m.tier === 3).length;

  return (
    <div className="flex items-center gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-center">
        <div className="text-lg font-semibold text-gray-900">{total}</div>
        <div className="text-xs text-gray-500">Total</div>
      </div>
      <div className="h-8 w-px bg-gray-200" />
      <div className="text-center">
        <div className="text-lg font-semibold text-indigo-600">{tier1}</div>
        <div className="text-xs text-gray-500">Core</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-amber-600">{tier2}</div>
        <div className="text-xs text-gray-500">Important</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold text-gray-600">{tier3}</div>
        <div className="text-xs text-gray-500">Supporting</div>
      </div>
    </div>
  );
}

function MomentCard({
  moment,
  tier,
}: {
  moment: ValueMoment;
  tier: ValueMomentTier;
}) {
  const config = tierConfig[tier];

  return (
    <Card className={config.borderColor}>
      <CardHeader className="pb-2">
        <CardTitle>{moment.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">{moment.description}</p>

        {moment.lenses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {moment.lenses.map((lens) => (
              <Badge
                key={lens}
                variant="secondary"
                className={config.badgeClass}
              >
                {lens}
              </Badge>
            ))}
          </div>
        )}

        {moment.roles.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500">Roles</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {moment.roles.map((role) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {moment.product_surfaces.length > 0 && (
          <div>
            <span className="text-xs font-medium text-gray-500">
              Surfaces
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {moment.product_surfaces.map((surface) => (
                <Badge key={surface} variant="outline" className="text-xs">
                  {surface}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TierSection({
  tier,
  moments,
}: {
  tier: ValueMomentTier;
  moments: ValueMoment[];
}) {
  if (moments.length === 0) return null;

  const config = tierConfig[tier];

  return (
    <div data-tier={tier} data-testid={`tier-${tier}`}>
      <h3 className={`text-sm font-semibold mb-3 ${config.headingColor}`}>
        {config.label}
      </h3>
      <div className="space-y-3">
        {moments.map((moment) => (
          <MomentCard key={moment.id} moment={moment} tier={tier} />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p className="text-sm font-medium text-gray-900">
        No value moments yet
      </p>
      <p className="text-sm text-gray-500 mt-1">
        Value moments will appear here after convergence analysis completes.
      </p>
    </div>
  );
}

export function ValueMomentsSection({ moments }: ValueMomentsSectionProps) {
  if (moments.length === 0) {
    return <EmptyState />;
  }

  const tier1 = moments.filter((m) => m.tier === 1);
  const tier2 = moments.filter((m) => m.tier === 2);
  const tier3 = moments.filter((m) => m.tier === 3);

  return (
    <div className="space-y-6">
      <StatsBar moments={moments} />
      <div className="space-y-6">
        <TierSection tier={1} moments={tier1} />
        <TierSection tier={2} moments={tier2} />
        <TierSection tier={3} moments={tier3} />
      </div>
    </div>
  );
}
