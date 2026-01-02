import dagre from "dagre";

interface Stage {
  _id: string;
  position: { x: number; y: number };
}

interface Transition {
  fromStageId: string;
  toStageId: string;
}

const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;

export function useAutoLayout() {
  const calculateLayout = (
    stages: Stage[],
    transitions: Transition[]
  ): Map<string, { x: number; y: number }> => {
    const g = new dagre.graphlib.Graph();

    g.setGraph({
      rankdir: "TB",
      nodesep: 80,
      ranksep: 100,
    });

    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes
    stages.forEach((stage) => {
      g.setNode(stage._id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    // Add edges
    transitions.forEach((t) => {
      g.setEdge(t.fromStageId, t.toStageId);
    });

    // Run layout
    dagre.layout(g);

    // Extract positions
    const positions = new Map<string, { x: number; y: number }>();
    stages.forEach((stage) => {
      const node = g.node(stage._id);
      if (node) {
        positions.set(stage._id, {
          x: node.x - NODE_WIDTH / 2,
          y: node.y - NODE_HEIGHT / 2,
        });
      }
    });

    return positions;
  };

  return { calculateLayout };
}
