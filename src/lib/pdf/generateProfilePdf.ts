import html2pdf from "html2pdf.js";
import {
  METRIC_CATEGORIES,
  CATEGORY_INFO,
  type MetricCategory,
} from "../../shared/metricTemplates";
import {
  LIFECYCLE_SLOTS,
  SLOT_INFO,
  type LifecycleSlot,
} from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
  entity?: string;
  action?: string;
}

interface Metric {
  _id: string;
  name: string;
  category: string;
}

interface Entity {
  _id: string;
  name: string;
  description?: string;
}

export interface ProfilePdfData {
  identity: {
    productName?: string;
    websiteUrl?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: string;
    revenueModels?: string[];
  };
  journeyMap: {
    stages: Stage[];
  };
  metricCatalog: {
    metrics: Record<MetricCategory, Metric[]>;
    totalCount: number;
  };
  measurementPlan: {
    entities: Entity[];
    activityCount: number;
    propertyCount: number;
  };
}

const REVENUE_MODEL_LABELS: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier Subscription",
  seat_subscription: "Seat Subscription",
  volume_based: "Volume Based",
};

function buildHtml(data: ProfilePdfData): string {
  const productName = data.identity.productName || "Product";
  const businessType = data.identity.hasMultiUserAccounts
    ? "B2B"
    : data.identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  // Build journey table rows
  const stageBySlot = new Map<LifecycleSlot, Stage>();
  data.journeyMap.stages.forEach((stage) => {
    if (stage.lifecycleSlot && !stageBySlot.has(stage.lifecycleSlot)) {
      stageBySlot.set(stage.lifecycleSlot, stage);
    }
  });

  const journeyRows = LIFECYCLE_SLOTS.map((slot) => {
    const stage = stageBySlot.get(slot);
    const slotName = SLOT_INFO[slot].name;
    if (stage) {
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${slotName}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${stage.name}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${stage.entity || "-"}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${stage.action || "-"}</td>
        </tr>
      `;
    }
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">${slotName}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; color: #9ca3af;">-</td>
      </tr>
    `;
  }).join("");

  // Build metrics sections
  const metricsSections = METRIC_CATEGORIES.map((category) => {
    const metrics = data.metricCatalog.metrics[category] || [];
    const categoryInfo = CATEGORY_INFO[category];
    if (metrics.length === 0) {
      return `
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">${categoryInfo.label}</h4>
          <p style="margin: 0; color: #9ca3af; font-size: 13px;">No metrics defined</p>
        </div>
      `;
    }
    const metricList = metrics
      .map((m) => `<li style="margin: 2px 0;">${m.name}</li>`)
      .join("");
    return `
      <div style="margin-bottom: 12px;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px;">${categoryInfo.label}</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">${metricList}</ul>
      </div>
    `;
  }).join("");

  // Build entities list
  const entitiesList = data.measurementPlan.entities
    .map((e) => `<li style="margin: 2px 0;">${e.name}${e.description ? ` - ${e.description}` : ""}</li>`)
    .join("");

  // Revenue models
  const revenueModels = (data.identity.revenueModels || [])
    .map((m) => REVENUE_MODEL_LABELS[m] || m)
    .join(", ");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #111827;">
      <!-- Header -->
      <div style="margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
        <h1 style="margin: 0 0 8px 0; font-size: 28px;">${productName}</h1>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <span style="background: #111827; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">${businessType}</span>
          ${revenueModels ? `<span style="background: #f3f4f6; padding: 4px 10px; border-radius: 12px; font-size: 12px;">${revenueModels}</span>` : ""}
        </div>
        ${data.identity.websiteUrl ? `<p style="margin: 8px 0 0 0; color: #6b7280; font-size: 13px;">${data.identity.websiteUrl}</p>` : ""}
      </div>

      <!-- Journey Map -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Journey Map</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Lifecycle Stage</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Stage Name</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Entity</th>
              <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${journeyRows}
          </tbody>
        </table>
      </div>

      <!-- Metric Catalog -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Metric Catalog</h2>
        ${metricsSections}
      </div>

      <!-- Measurement Plan -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Measurement Plan</h2>
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px;">Entities (${data.measurementPlan.entities.length})</h4>
          ${entitiesList ? `<ul style="margin: 0; padding-left: 20px; font-size: 13px;">${entitiesList}</ul>` : '<p style="margin: 0; color: #9ca3af; font-size: 13px;">No entities defined</p>'}
        </div>
        <div style="font-size: 13px; color: #6b7280;">
          <span>${data.measurementPlan.activityCount} activities</span> ·
          <span>${data.measurementPlan.propertyCount} properties</span>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
        Generated by Basesignal · ${new Date().toLocaleDateString()}
      </div>
    </div>
  `;
}

export async function generateProfilePdf(data: ProfilePdfData): Promise<void> {
  const productName = data.identity.productName || "Product";
  const filename = `${productName}-profile.pdf`;

  const html = buildHtml(data);

  const options = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
  };

  await html2pdf().set(options).from(html).save();
}
