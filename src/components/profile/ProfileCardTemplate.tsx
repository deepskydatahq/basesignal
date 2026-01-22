import { forwardRef } from "react";

interface ProfileCardTemplateProps {
  productName: string;
  description?: string;
  stages: string[];
  completeness: { completed: number; total: number };
  metricsCount: number;
  entitiesCount: number;
}

export const ProfileCardTemplate = forwardRef<
  HTMLDivElement,
  ProfileCardTemplateProps
>(function ProfileCardTemplate(
  {
    productName,
    description,
    stages,
    completeness,
    metricsCount,
    entitiesCount,
  },
  ref
) {
  return (
    <div
      ref={ref}
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        padding: "60px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Header: Logo + Branding */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            backgroundColor: "#000",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "24px",
            fontWeight: 700,
          }}
        >
          B
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>BASESIGNAL</div>
          <div style={{ fontSize: "14px", color: "#666" }}>
            Outcome-driven product analytics
          </div>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "#e5e5e5",
          marginTop: "24px",
          marginBottom: "24px",
        }}
      />

      {/* Product Info */}
      <div
        style={{
          fontSize: "36px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {productName || "Your Product"}
      </div>
      <div
        style={{
          fontSize: "18px",
          color: "#666",
          marginBottom: "32px",
        }}
      >
        {description || "Product P&L Dashboard"}
      </div>

      {/* Journey Stages */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "40px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "14px", color: "#666" }}>Journey:</span>
        {stages.map((stage, i) => (
          <span key={stage}>
            <span style={{ fontSize: "16px", fontWeight: 500 }}>{stage}</span>
            {i < stages.length - 1 && (
              <span style={{ color: "#ccc", fontSize: "16px", marginLeft: "8px", marginRight: "8px" }}>→</span>
            )}
          </span>
        ))}
      </div>

      {/* Stats Badges */}
      <div style={{ display: "flex", gap: "24px" }}>
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: 700 }}>
            {completeness.completed}/{completeness.total}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>Complete</div>
        </div>
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: 700 }}>{metricsCount}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Metrics</div>
        </div>
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: 700 }}>{entitiesCount}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Entities</div>
        </div>
      </div>

      {/* Footer (spacer + text) */}
      <div style={{ flexGrow: 1 }} />
      <div style={{ fontSize: "14px", color: "#999" }}>
        Built with Basesignal · basesignal.net
      </div>
    </div>
  );
});
