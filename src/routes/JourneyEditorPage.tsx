import { useQuery, useMutation } from "convex/react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ArrowLeft, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import JourneyCanvas from "../components/journey/JourneyCanvas";
import StageDetailPanel from "../components/journey/StageDetailPanel";
import { useAutoLayout } from "../components/journey/useAutoLayout";
import { InterviewPanel, InterviewHistoryButton, InterviewHistoryDrawer } from "../components/interview";
import { Button } from "../components/ui/button";

export default function JourneyEditorPage() {
  const { journeyId } = useParams<{ journeyId: string }>();
  const journey = useQuery(
    api.journeys.get,
    journeyId ? { id: journeyId as Id<"journeys"> } : "skip"
  );
  const stages = useQuery(
    api.stages.listByJourney,
    journeyId ? { journeyId: journeyId as Id<"journeys"> } : "skip"
  );
  const transitions = useQuery(
    api.transitions.listByJourney,
    journeyId ? { journeyId: journeyId as Id<"journeys"> } : "skip"
  );
  const createStage = useMutation(api.stages.create);
  const updateStage = useMutation(api.stages.update);
  const updateStagePosition = useMutation(api.stages.updatePosition);
  const removeStage = useMutation(api.stages.remove);
  const createTransition = useMutation(api.transitions.create);
  const removeTransition = useMutation(api.transitions.remove);
  const updateJourney = useMutation(api.journeys.update);

  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const selectedStage = stages?.find((s) => s._id === selectedStageId);

  const { calculateLayout } = useAutoLayout();

  // Create set of activities used in value rules (TODO: re-implement with better design)
  const activitiesInRules = new Set<string>();

  // Get value rule name for a stage (TODO: re-implement with better design)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getValueRuleName = (_stageName: string): string | undefined => undefined;

  // Auto-open interview panel for empty journeys
  useEffect(() => {
    if (stages && stages.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsInterviewOpen(true);
    }
  }, [stages]);

  const handleAddStage = async () => {
    if (!journeyId) return;
    const hasEntry = stages?.some((s) => s.type === "entry");
    await createStage({
      journeyId: journeyId as Id<"journeys">,
      name: hasEntry ? "New Activity" : "Entry",
      type: hasEntry ? "activity" : "entry",
      position: { x: 250, y: (stages?.length || 0) * 100 + 50 },
    });
  };

  const handleStageMove = async (
    stageId: string,
    position: { x: number; y: number }
  ) => {
    await updateStagePosition({
      id: stageId as Id<"stages">,
      position,
    });
  };

  const handleConnect = async (fromStageId: string, toStageId: string) => {
    if (!journeyId) return;
    await createTransition({
      journeyId: journeyId as Id<"journeys">,
      fromStageId: fromStageId as Id<"stages">,
      toStageId: toStageId as Id<"stages">,
    });
  };

  const handleDeleteStage = async (stageId: string) => {
    await removeStage({ id: stageId as Id<"stages"> });
    if (selectedStageId === stageId) {
      setSelectedStageId(null);
    }
  };

  const handleDeleteTransition = async (transitionId: string) => {
    await removeTransition({ id: transitionId as Id<"transitions"> });
  };

  const handleUpdateStage = async (name: string, type: string) => {
    if (!selectedStageId || !stages) return;

    // If changing to entry, demote existing entry
    if (type === "entry") {
      const existingEntry = stages.find(
        (s) => s.type === "entry" && s._id !== selectedStageId
      );
      if (existingEntry) {
        const confirmed = confirm(
          "A journey can only have one entry point. Replace the existing entry?"
        );
        if (!confirmed) return;

        // Demote old entry to activity
        await updateStage({
          id: existingEntry._id as Id<"stages">,
          type: "activity",
        });
      }
    }

    await updateStage({
      id: selectedStageId as Id<"stages">,
      name,
      type,
    });
  };

  const handleOrganize = async () => {
    if (!stages || !transitions) return;

    const newPositions = calculateLayout(stages, transitions);

    // Update all positions in parallel
    const updates = Array.from(newPositions.entries()).map(([id, position]) =>
      updateStagePosition({ id: id as Id<"stages">, position })
    );

    await Promise.all(updates);
  };

  const handleSaveName = async () => {
    if (!journey || !editName.trim()) {
      setIsEditingName(false);
      return;
    }
    await updateJourney({ id: journey._id, name: editName.trim() });
    setIsEditingName(false);
  };

  if (!journeyId) {
    return <div className="p-6 text-gray-500">Invalid journey ID</div>;
  }

  if (journey === undefined || stages === undefined || transitions === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (journey === null) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h2 className="text-lg font-medium text-gray-900">Journey not found</h2>
        <Link to="/journeys" className="text-blue-600 hover:underline">
          Back to journeys
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen -m-6">
      {/* Interview Panel */}
      <InterviewPanel
        journeyId={journeyId as Id<"journeys">}
        journeyType={journey.type as "first_value" | "retention" | "value_outcomes" | "value_capture" | "churn"}
        isOpen={isInterviewOpen}
        onToggle={() => setIsInterviewOpen(!isInterviewOpen)}
      />

      {/* Main editor area */}
      <div className={`${isInterviewOpen ? "w-1/2" : "flex-1"} flex flex-col`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <Link
              to="/journeys"
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {isEditingName ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="text-sm font-medium text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
                autoFocus
              />
            ) : (
              <h1
                onClick={() => {
                  setEditName(journey.name);
                  setIsEditingName(true);
                }}
                className="text-sm font-medium text-gray-900 cursor-text hover:text-blue-600"
              >
                {journey.name}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <InterviewHistoryButton
              journeyId={journeyId as Id<"journeys">}
              onClick={() => setIsHistoryOpen(true)}
            />
            <Button variant="outline" size="sm" onClick={handleOrganize}>
              Organize
            </Button>
            <Button size="sm" onClick={handleAddStage}>
              <Plus className="w-4 h-4 mr-1" />
              Add Stage
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-50 relative">
          {stages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="text-center text-gray-400">
                <p className="text-sm">Stages will appear here</p>
                <p className="text-xs mt-1">Use the interview to define your journey</p>
              </div>
            </div>
          ) : (
            <JourneyCanvas
              stages={stages}
              transitions={transitions}
              onStageSelect={setSelectedStageId}
              onStageMove={handleStageMove}
              onConnect={handleConnect}
              onDeleteStage={handleDeleteStage}
              onDeleteTransition={handleDeleteTransition}
              activitiesInRules={activitiesInRules}
            />
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedStage && (
        <div className="w-80 border-l border-gray-200 bg-white">
          <StageDetailPanel
            stage={selectedStage}
            onUpdate={handleUpdateStage}
            onDelete={() => handleDeleteStage(selectedStageId!)}
            onClose={() => setSelectedStageId(null)}
            valueRuleName={getValueRuleName(selectedStage.name)}
          />
        </div>
      )}

      {/* Interview History Drawer */}
      <InterviewHistoryDrawer
        journeyId={journeyId as Id<"journeys">}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </div>
  );
}
