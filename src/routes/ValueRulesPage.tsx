import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const RULE_TYPES = [
  { value: "activation", label: "Activation", description: "When is an account considered 'activated'?" },
  { value: "active", label: "Active", description: "When is an account considered 'active'?" },
  { value: "at_risk", label: "At Risk", description: "When is an account at risk of churning?" },
];

const TIME_WINDOWS = [
  { value: "first_7d", label: "First 7 days" },
  { value: "first_14d", label: "First 14 days" },
  { value: "first_30d", label: "First 30 days" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "ever", label: "Ever (all time)" },
];

const CONDITIONS = [
  { value: "all", label: "All activities must occur" },
  { value: "any", label: "Any activity triggers" },
  { value: "n_of", label: "N or more activities occur" },
];

export default function ValueRulesPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();

  const connection = useQuery(api.amplitude.getById, {
    id: connectionId as Id<"amplitudeConnections">,
  });
  const activities = useQuery(api.activityDefinitions.listByConnection, {
    connectionId: connectionId as Id<"amplitudeConnections">,
  });
  const valueRules = useQuery(api.valueRules.listByConnection, {
    connectionId: connectionId as Id<"amplitudeConnections">,
  });

  const createRule = useMutation(api.valueRules.create);
  const updateRule = useMutation(api.valueRules.update);
  const removeRule = useMutation(api.valueRules.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRuleType, setSelectedRuleType] = useState("activation");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [condition, setCondition] = useState("all");
  const [count, setCount] = useState(1);
  const [timeWindow, setTimeWindow] = useState("first_14d");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleActivity = (activity: string) => {
    setSelectedActivities(prev =>
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    );
  };

  const handleCreate = async () => {
    if (!connectionId || !name || selectedActivities.length === 0) {
      setError("Please provide a name and select at least 1 activity");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createRule({
        connectionId: connectionId as Id<"amplitudeConnections">,
        ruleType: selectedRuleType,
        name,
        description: description || undefined,
        activities: selectedActivities,
        condition,
        count: condition === "n_of" ? count : undefined,
        timeWindow,
        enabled: true,
      });
      // Reset form
      setName("");
      setDescription("");
      setSelectedActivities([]);
      setCondition("all");
      setTimeWindow("first_14d");
      setIsDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleEnabled = async (ruleId: Id<"valueRules">, enabled: boolean) => {
    await updateRule({ id: ruleId, enabled });
  };

  const handleDelete = async (ruleId: Id<"valueRules">) => {
    if (confirm("Delete this rule?")) {
      await removeRule({ id: ruleId });
    }
  };

  if (!connection) {
    return <div className="p-6">Loading...</div>;
  }

  const activityNames = activities?.map(a => a.name) || [];

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate(`/sources/amplitude/${connectionId}/activities`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Activities
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Value Rules</h1>
          <p className="text-muted-foreground">
            Define what "activated", "active", and "at risk" mean for your product.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Value Rule</DialogTitle>
              <DialogDescription>
                Define when an account transitions to a specific state.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select value={selectedRuleType} onValueChange={setSelectedRuleType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>
                        {rt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {RULE_TYPES.find(rt => rt.value === selectedRuleType)?.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  placeholder="e.g., Core Feature Activation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="e.g., User has used the core feature at least once"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Activities to Check</Label>
                <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                  {activityNames.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No activities defined. Create activity mappings first.
                    </p>
                  ) : (
                    activityNames.map((activity) => (
                      <div key={activity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`activity-${activity}`}
                          checked={selectedActivities.includes(activity)}
                          onCheckedChange={() => toggleActivity(activity)}
                        />
                        <label
                          htmlFor={`activity-${activity}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {activity}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {condition === "n_of" && (
                <div className="space-y-2">
                  <Label>Minimum Required</Label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedActivities.length || 10}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Time Window</Label>
                <Select value={timeWindow} onValueChange={setTimeWindow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_WINDOWS.map((tw) => (
                      <SelectItem key={tw.value} value={tw.value}>
                        {tw.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {selectedRuleType === "activation" && "Usually 'First N days' for activation."}
                  {selectedRuleType === "active" && "Usually 'Last N days' for activity."}
                  {selectedRuleType === "at_risk" && "Usually 'Last N days' for risk detection."}
                </p>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                  {error}
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={isCreating || !name || selectedActivities.length === 0}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Create Rule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {valueRules === undefined ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : valueRules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No value rules defined yet. Click "Add Rule" to define activation, active, or at-risk criteria.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {valueRules.map((rule) => (
            <Card key={rule._id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        rule.ruleType === "activation" ? "bg-green-100 text-green-700" :
                        rule.ruleType === "active" ? "bg-blue-100 text-blue-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {rule.ruleType}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rule.condition === "all" && "All of: "}
                      {rule.condition === "any" && "Any of: "}
                      {rule.condition === "n_of" && `${rule.count}+ of: `}
                      {rule.activities.join(", ")}
                      {" in "}
                      {TIME_WINDOWS.find(tw => tw.value === rule.timeWindow)?.label.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant={rule.enabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleEnabled(rule._id, !rule.enabled)}
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(rule._id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button
          variant="outline"
          onClick={() => navigate("/sources")}
          className="w-full"
        >
          Done - Back to Sources
        </Button>
      </div>
    </div>
  );
}
