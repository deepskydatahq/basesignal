import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { Check, Map, BarChart3, List } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../ui/button";

interface Props {
  productName: string;
}

export function BriefingScreen({ productName }: Props) {
  const navigate = useNavigate();
  const startSetup = useMutation(api.setupProgress.start);

  const handleStartSetup = async () => {
    await startSetup();
    navigate("/setup/interview");
  };

  return (
    <div className="space-y-8">
      {/* Philosophy reminder */}
      <p className="text-sm text-gray-500 text-center">
        We don't track clicks – we track what matters to your business
      </p>

      {/* What you'll need checklist */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">What you'll need</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-sm text-gray-600">15 minutes of focused time</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-sm text-gray-600">
              Knowledge of {productName || "your product"}'s user journey
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-sm text-gray-600">
              Optional: a colleague who knows the product well
            </span>
          </div>
        </div>
      </div>

      {/* What you'll walk away with - 3 output cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">What you'll walk away with</h2>
        <div className="grid grid-cols-3 gap-3">
          {/* User Journey Map */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Map className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">User Journey Map</h3>
              <p className="text-xs text-gray-500 mt-1">
                Visual map of how users move from signup to value
              </p>
            </div>
          </div>

          {/* Measurement Plan */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-3 relative">
            <span className="absolute top-2 right-2 text-[10px] text-gray-400">Coming soon</span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Measurement Plan</h3>
              <p className="text-xs text-gray-500 mt-1">
                Outcome-focused tracking: Entity + Activity + Property
              </p>
            </div>
          </div>

          {/* Metric Catalog */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-3 relative">
            <span className="absolute top-2 right-2 text-[10px] text-gray-400">Coming soon</span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <List className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Metric Catalog</h3>
              <p className="text-xs text-gray-500 mt-1">
                Metrics connecting activities to business outcomes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3 pt-4">
        <p className="text-center text-gray-900 font-medium">
          Ready? Let's build your measurement foundation.
        </p>
        <Button onClick={handleStartSetup} className="w-full" size="lg">
          Start Setup
        </Button>
      </div>
    </div>
  );
}
