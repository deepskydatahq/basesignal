import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Map, FileText, BarChart3, Sparkles } from "lucide-react";

interface SetupCompletionScreenProps {
  productName?: string;
}

export function SetupCompletionScreen({ productName }: SetupCompletionScreenProps) {
  const navigate = useNavigate();

  const handleEnterApp = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        {/* Celebration header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Foundation is Ready
          </h1>
          <p className="text-gray-600">
            This usually takes a week. You did it in 15 minutes.
          </p>
        </div>

        {/* Output cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-3">
              <Map className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Journey Map</h3>
            <p className="text-sm text-gray-500">
              {productName ? `${productName}'s` : "Your"} core user journey
            </p>
          </Card>

          <Card className="p-6 text-center bg-gray-50 border-dashed">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-200 rounded-lg mb-3">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-400 mb-1">Measurement Plan</h3>
            <p className="text-sm text-gray-400">Coming soon</p>
          </Card>

          <Card className="p-6 text-center bg-gray-50 border-dashed">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-200 rounded-lg mb-3">
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-400 mb-1">Metric Catalog</h3>
            <p className="text-sm text-gray-400">Coming soon</p>
          </Card>
        </div>

        {/* Value reinforcement */}
        <p className="text-gray-600 mb-8">
          You now have the foundation for measuring what matters.
        </p>

        {/* CTA */}
        <Button onClick={handleEnterApp} size="lg" className="px-8">
          Enter Basesignal
        </Button>
      </div>
    </div>
  );
}
