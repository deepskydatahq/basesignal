import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ExternalLink, Trash2 } from "lucide-react";

export default function AmplitudeConfirmPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connection = useQuery(
    api.amplitude.getById,
    connectionId ? { id: connectionId as Id<"amplitudeConnections"> } : "skip"
  );
  const createPipeline = useAction(api.amplitudeActions.createPipeline);
  const deleteConnection = useMutation(api.amplitude.remove);

  const handleCreatePipeline = async () => {
    if (!connectionId) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = await createPipeline({
        connectionId: connectionId as Id<"amplitudeConnections">,
      });

      if (result.success) {
        // Navigate to sources page with success message and workflow URL
        navigate("/sources", {
          state: {
            message: "Pipeline created successfully!",
            workflowUrl: result.workflowUrl,
          },
        });
      } else {
        setError(result.error || "Failed to create pipeline");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!connectionId || !confirm("Are you sure you want to delete this connection?")) return;

    setIsDeleting(true);
    try {
      await deleteConnection({ id: connectionId as Id<"amplitudeConnections"> });
      navigate("/sources");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  if (!connection) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  // Show pipeline status view if already connected
  if (connection.status === "connected" && connection.configPath) {
    return (
      <div className="container mx-auto py-6 max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <CardTitle>Pipeline Active</CardTitle>
            </div>
            <CardDescription>
              Your Amplitude data pipeline is configured and running.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Connection</div>
              <div className="text-lg">{connection.name}</div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Status</div>
              <Badge variant="default" className="bg-green-500">
                {connection.status}
              </Badge>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">
                Selected Events ({connection.selectedEvents.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {connection.selectedEvents.slice(0, 10).map((event) => (
                  <Badge key={event} variant="secondary" className="font-mono">
                    {event}
                  </Badge>
                ))}
                {connection.selectedEvents.length > 10 && (
                  <Badge variant="outline">
                    +{connection.selectedEvents.length - 10} more
                  </Badge>
                )}
              </div>
            </div>

            {connection.configPath && (
              <div>
                <div className="text-sm font-medium mb-2">Config Path</div>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {connection.configPath}
                </code>
              </div>
            )}

            {connection.lastRunAt && (
              <div>
                <div className="text-sm font-medium mb-2">Last Sync</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(connection.lastRunAt).toLocaleString()}
                  {connection.lastRowCount !== undefined && (
                    <span className="ml-2">({connection.lastRowCount.toLocaleString()} rows)</span>
                  )}
                </div>
              </div>
            )}

            {connection.workflowUrl && (
              <div>
                <div className="text-sm font-medium mb-2">GitHub Workflow</div>
                <a
                  href={connection.workflowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  View latest run <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                {error}
              </div>
            )}

            <div className="pt-4 border-t space-y-3">
              <div className="text-sm font-medium">Configure Data Model</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/sources/amplitude/${connectionId}/account-mapping`)}
                >
                  Account Mapping
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/sources/amplitude/${connectionId}/activities`)}
                >
                  Activity Definitions
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/sources")}
              >
                Back to Sources
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="ml-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show create pipeline view
  return (
    <div className="container mx-auto py-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Create Pipeline</CardTitle>
          <CardDescription>
            Review your selection and create the data pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Connection</div>
            <div className="text-lg">{connection.name}</div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">
              Selected Events ({connection.selectedEvents.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {connection.selectedEvents.slice(0, 10).map((event) => (
                <Badge key={event} variant="secondary" className="font-mono">
                  {event}
                </Badge>
              ))}
              {connection.selectedEvents.length > 10 && (
                <Badge variant="outline">
                  +{connection.selectedEvents.length - 10} more
                </Badge>
              )}
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-4">
              This will create a data pipeline that syncs the selected events
              daily. You can monitor progress on the Sources page.
            </div>

            {error && (
              <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/sources/amplitude/${connectionId}/events`)}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button
                onClick={handleCreatePipeline}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? "Creating Pipeline..." : "Create Pipeline"}
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium mb-2">Configure Data Model</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set up how your Amplitude data maps to the P&L account model.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(`/sources/amplitude/${connectionId}/account-mapping`)}
              className="w-full"
            >
              Configure Account Mapping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
