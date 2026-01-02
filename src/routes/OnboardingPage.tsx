import { useState } from "react";
import { OnboardingLayout } from "../components/onboarding/OnboardingLayout";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { PhilosophyScreen } from "../components/onboarding/screens/PhilosophyScreen";
import { ContextScreen } from "../components/onboarding/screens/ContextScreen";
import { BriefingScreen } from "../components/onboarding/screens/BriefingScreen";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ContextData {
  productName: string;
  role: string;
  hasMultiUserAccounts: boolean;
  businessType: string | undefined;
  revenueModels: string[];
}

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const updateOnboarding = useMutation(api.users.updateOnboarding);

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

  // Determine modal size based on step
  const modalSize = step === 2 ? "wide" : "medium";

  const screens = [
    <PhilosophyScreen key="philosophy" onNext={() => setStep(1)} />,
    <ContextScreen key="context" onNext={handleContextSubmit} />,
    <BriefingScreen key="briefing" productName={context.productName} />,
  ];

  return (
    <OnboardingLayout>
      <OnboardingModal currentStep={step} totalSteps={TOTAL_STEPS} size={modalSize}>
        {screens[step]}
      </OnboardingModal>
    </OnboardingLayout>
  );
}
