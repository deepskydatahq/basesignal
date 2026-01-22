import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateProfilePdf,
  type ProfilePdfData,
} from "../../lib/pdf/generateProfilePdf";

interface ExportPdfButtonProps {
  profileData: ProfilePdfData;
}

export function ExportPdfButton({ profileData }: ExportPdfButtonProps) {
  const handleExport = () => {
    generateProfilePdf(profileData);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleExport}>
      <Download className="w-4 h-4 mr-1" />
      Export PDF
    </Button>
  );
}
