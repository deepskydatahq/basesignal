import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from "@xyflow/react";
import type { Node, Edge, OnConnect, Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect } from "react";

interface JourneyCanvasProps {
  stages: Array<{
    _id: string;
    name: string;
    type: string;
    position: { x: number; y: number };
  }>;
  transitions: Array<{
    _id: string;
    fromStageId: string;
    toStageId: string;
  }>;
  onStageSelect: (stageId: string | null) => void;
  onStageMove: (stageId: string, position: { x: number; y: number }) => void;
  onConnect: (fromStageId: string, toStageId: string) => void;
  onDeleteStage: (stageId: string) => void;
  onDeleteTransition: (transitionId: string) => void;
  activitiesInRules: Set<string>;
}

export default function JourneyCanvas({
  stages,
  transitions,
  onStageSelect,
  onStageMove,
  onConnect,
  onDeleteStage,
  onDeleteTransition,
  activitiesInRules,
}: JourneyCanvasProps) {
  // Helper function to convert stages to React Flow nodes
  const toNodes = (): Node[] =>
    stages.map((stage) => {
      const isInValueRule = activitiesInRules.has(stage.name);
      const isEntry = stage.type === "entry";

      return {
        id: stage._id,
        type: "default",
        position: stage.position,
        data: { label: stage.name },
        style: {
          border: isInValueRule
            ? "2px solid #f59e0b" // gold border for value rules
            : isEntry
              ? "2px solid #22c55e" // green border for entry
              : "1px solid #d1d5db", // gray border for normal
          borderRadius: isEntry ? "8px" : "4px",
          padding: "10px 20px",
          background: isInValueRule ? "#fef3c7" : "white", // light yellow for value rules
        },
      };
    });

  // Helper function to convert transitions to React Flow edges
  const toEdges = (): Edge[] =>
    transitions.map((t) => ({
      id: t._id,
      source: t.fromStageId,
      target: t.toStageId,
      type: "default",
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(toEdges());

  // Sync nodes when stages or activitiesInRules change
  useEffect(() => {
    setNodes(toNodes());
  }, [stages, activitiesInRules]);

  // Sync edges when transitions change
  useEffect(() => {
    setEdges(toEdges());
  }, [transitions]);

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        onConnect(connection.source, connection.target);
        setEdges((eds) => addEdge(connection, eds));
      }
    },
    [onConnect, setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onStageSelect(node.id);
    },
    [onStageSelect]
  );

  const handlePaneClick = useCallback(() => {
    onStageSelect(null);
  }, [onStageSelect]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onStageMove(node.id, node.position);
    },
    [onStageMove]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Backspace" || event.key === "Delete") {
        const selectedNodes = nodes.filter((n) => n.selected);
        const selectedEdges = edges.filter((e) => e.selected);

        selectedNodes.forEach((node) => onDeleteStage(node.id));
        selectedEdges.forEach((edge) => onDeleteTransition(edge.id));
      }
    },
    [nodes, edges, onDeleteStage, onDeleteTransition]
  );

  return (
    <div className="h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
