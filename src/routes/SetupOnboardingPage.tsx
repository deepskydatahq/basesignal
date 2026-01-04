import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { PhilosophyScreen } from "../components/onboarding/screens/PhilosophyScreen";
import { ContextScreen } from "../components/onboarding/screens/ContextScreen";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Check, Map, BarChart3, List } from "lucide-react";
import { Button } from "../components/ui/button";

interface ContextData {
  productName: string;
  role: string;
  hasMultiUserAccounts: boolean;
  businessType: string | undefined;
  revenueModels: string[];
}

const TOTAL_STEPS = 3;

export default function SetupOnboardingPage() {
  const navigate = useNavigate();
  const updateOnboarding = useMutation(api.users.updateOnboarding);
  const updateSetupProgress = useMutation(api.setupProgress.update);

  const [step, setStep] = useState(0);
  const [context, setContext] = useState<ContextData>({
    productName: "",
    role: "",
    hasMultiUserAccounts: false,
    businessType: undefined,
    revenueModels: [],
  });

  const handleContextSubmit = async (data: ContextData) => {
    setContext(data);
    try {
      await updateOnboarding({
        productName: data.productName,
        role: data.role,
        hasMultiUserAccounts: data.hasMultiUserAccounts,
        businessType: data.businessType,
        revenueModels: data.revenueModels,
        onboardingStep: "briefing",
      });
      setStep(2);
    } catch (error) {
      console.error("Failed to save onboarding data:", error);
    }
  };

  const handleStartInterview = async () => {
    // Advance setup progress to interview step
    await updateSetupProgress({
      currentStep: "overview_interview",
      stepsCompleted: ["onboarding"],
    });
    navigate("/setup/interview");
  };

  // Determine modal size based on step
  const modalSize = step === 2 ? "wide" : "medium";

  const screens = [
    <PhilosophyScreen key="philosophy" onNext={() => setStep(1)} />,
    <ContextScreen key="context" onNext={handleContextSubmit} />,
    <SetupBriefingScreen
      key="briefing"
      productName={context.productName}
      onStart={handleStartInterview}
    />,
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <OnboardingModal currentStep={step} totalSteps={TOTAL_STEPS} size={modalSize}>
        {screens[step]}
      </OnboardingModal>
    </div>
  );
}

// Simplified briefing screen for setup flow (doesn't call startSetup)
function SetupBriefingScreen({
  productName,
  onStart,
}: {
  productName: string;
  onStart: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Philosophy reminder */}
      <p className="text-sm text-gray-500 text-center">
        We don't track clicks - we track what matters to your business
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
        <Button onClick={onStart} className="w-full" size="lg">
          Start Interview
        </Button>
      </div>
    </div>
  );
}
