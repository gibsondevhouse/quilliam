"use client";

import type { GraphEdge, GraphNode } from "./useGraphData";

const TYPE_LABEL: Record<string, string> = {
  character: "Character",
  location: "Location",
  culture: "Culture",
  organization: "Organization",
  system: "System",
  item: "Item",
  language: "Language",
  religion: "Religion",
  lineage: "Lineage",
  economy: "Economy",
  rule: "Rule",
  faction: "Faction",
  magic_system: "Magic System",
  lore_entry: "Lore",
};

const CANON_LABEL: Record<string, string> = {
  canon: "canon",
  proposed: "proposed",
  draft: "draft",
  deprecated: "deprecated",
  retconned: "retconned",
  "alternate-branch": "alt branch",
};

interface Props {
  node: GraphNode;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
}

export function NodeDetail({ node, edges, allNodes, onClose, onSelectNode }: Props) {
  const nodeMap = new Map<string, GraphNode>(allNodes.map((n) => [n.id, n]));

  const connections = edges
    .filter((e) => e.fromId === node.id || e.toId === node.id)
    .map((e) => {
      const otherId = e.fromId === node.id ? e.toId : e.fromId;
      const direction = e.fromId === node.id ? "→" : "←";
      const other = nodeMap.get(otherId);
      return { id: e.id, otherId, direction, type: e.type, otherName: other?.name ?? "Unknown", otherType: other?.entryType };
    });

  return (
    <aside className="rel-web-detail">
      <div className="rel-web-detail-header">
        <div className="rel-web-detail-title">
          <span className="rel-web-detail-type">
            {TYPE_LABEL[node.entryType] ?? node.entryType}
          </span>
          <span className={`rel-web-detail-canon rel-web-canon-${node.canonStatus}`}>
            {CANON_LABEL[node.canonStatus] ?? node.canonStatus}
          </span>
        </div>
        <button className="rel-web-detail-close" onClick={onClose} title="Close">✕</button>
      </div>

      <h3 className="rel-web-detail-name">{node.name}</h3>

      {node.summary && (
        <p className="rel-web-detail-summary">{node.summary}</p>
      )}

      <div className="rel-web-detail-section">
        <div className="rel-web-detail-section-label">
          Connections ({connections.length})
        </div>
        {connections.length === 0 ? (
          <p className="rel-web-detail-empty">No connections recorded.</p>
        ) : (
          <ul className="rel-web-conn-list">
            {connections.map((conn) => (
              <li key={conn.id} className="rel-web-conn-item">
                <span className="rel-web-conn-dir">{conn.direction}</span>
                <button
                  className="rel-web-conn-name"
                  onClick={() => onSelectNode(conn.otherId)}
                  title={`Select ${conn.otherName}`}
                >
                  {conn.otherName}
                </button>
                <span className="rel-web-conn-type">
                  {conn.type.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
