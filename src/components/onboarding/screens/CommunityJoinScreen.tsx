import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../ui/button";
import { ExternalLink, Mail } from "lucide-react";

interface CommunityJoinScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export function CommunityJoinScreen({
  onNext,
  onBack,
}: CommunityJoinScreenProps) {
  const config = useQuery(api.communityJoin.getConfig);
  const verify = useMutation(api.communityJoin.verify);

  const [honorChecked, setHonorChecked] = useState(false);
  const [magicCode, setMagicCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailFallbackUsed, setEmailFallbackUsed] = useState(false);

  const mode = config?.mode || "honor";
  const discordInvite = config?.discordInvite || "";

  const canContinue =
    emailFallbackUsed ||
    (mode === "honor" && honorChecked) ||
    (mode === "magic_code" && magicCode.length > 0);

  const handleContinue = async () => {
    setIsVerifying(true);
    setCodeError("");

    try {
      if (emailFallbackUsed) {
        await verify({ method: "email_fallback" });
      } else if (mode === "honor") {
        await verify({ method: "honor" });
      } else {
        await verify({ method: "magic_code", code: magicCode });
      }
      onNext();
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid code") {
        setCodeError(
          "That code doesn't match. Check the pinned message in #welcome."
        );
      } else {
        setCodeError("Something went wrong. Please try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEmailFallback = () => {
    // Open email client
    const subject = encodeURIComponent("Community Join Help");
    const body = encodeURIComponent(
      "Hi, I'm having trouble joining the Discord community. Can you help me proceed with setup?"
    );
    window.open(
      `mailto:support@basesignal.com?subject=${subject}&body=${body}`,
      "_blank"
    );

    // Mark as used so they can continue
    setEmailFallbackUsed(true);
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center p-8">Loading...</div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-gray-900">
          Join our early adopter community
        </h1>
        <p className="text-sm text-gray-600">
          Basesignal is launching and we're building this with you. Before you
          continue, join our Discord – it's where you'll get support, share
          feedback, and help shape what we build next.
        </p>
        <p className="text-sm text-gray-500 italic">
          This isn't optional (yet). We're a small team and your input is how we
          make this great.
        </p>
      </div>

      {/* Discord Join Button */}
      <div className="flex justify-center">
        <a
          href={discordInvite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#5865F2] text-white rounded-lg font-medium hover:bg-[#4752C4] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Join Discord
        </a>
      </div>

      {/* Verification Section */}
      <div className="border-t border-gray-200 pt-6 space-y-4">
        {mode === "honor" ? (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={honorChecked}
              onChange={(e) => setHonorChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I've joined the Discord community
            </span>
          </label>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm text-gray-700">
              Already joined? Enter the code from #welcome:
            </label>
            <input
              type="text"
              value={magicCode}
              onChange={(e) => {
                setMagicCode(e.target.value.toUpperCase());
                setCodeError("");
              }}
              placeholder="Enter code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {codeError && <p className="text-sm text-red-600">{codeError}</p>}
          </div>
        )}
      </div>

      {/* Email Fallback */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={handleEmailFallback}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <Mail className="w-4 h-4" />
          Having trouble? Email us to continue
        </button>
        {emailFallbackUsed && (
          <p className="text-sm text-green-600 mt-2">
            Email opened! You can now continue.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue || isVerifying}>
          {isVerifying ? "Verifying..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
