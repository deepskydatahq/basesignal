import { useState, useRef } from "react";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";
import { ProfileCardTemplate } from "./ProfileCardTemplate";

interface DownloadCardButtonProps {
  productName: string;
  description?: string;
  stages: string[];
  completeness: { completed: number; total: number };
  metricsCount: number;
  entitiesCount: number;
}

export function DownloadCardButton({
  productName,
  description,
  stages,
  completeness,
  metricsCount,
  entitiesCount,
}: DownloadCardButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;

    setIsDownloading(true);

    try {
      const dataUrl = await toPng(cardRef.current, {
        width: 1200,
        height: 630,
        pixelRatio: 2,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "basesignal-profile.png";
      a.click();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        {isDownloading ? "Generating..." : "Download Card"}
      </button>

      {/* Hidden card template for image generation */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
        }}
      >
        <ProfileCardTemplate
          ref={cardRef}
          productName={productName}
          description={description}
          stages={stages}
          completeness={completeness}
          metricsCount={metricsCount}
          entitiesCount={entitiesCount}
        />
      </div>
    </>
  );
}
