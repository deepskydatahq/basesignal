import { Button } from "../../ui/button";

interface Props {
  onNext: () => void;
}

export function PhilosophyScreen({ onNext }: Props) {
  return (
    <div className="space-y-8 text-center">
      {/* Problem statement */}
      <div className="space-y-3">
        <h1 className="text-xl font-medium">
          Tracking plans focus on interactions
        </h1>
        <p className="text-gray-600">
          Where users click, what they view. But clicks don't tell you if users succeeded.
        </p>
      </div>

      {/* Code snippet mockup */}
      <div className="space-y-2 text-left max-w-xs mx-auto font-mono text-sm">
        <div className="p-2 bg-gray-100 rounded">page_viewed: /dashboard</div>
        <div className="p-2 bg-gray-100 rounded">button_clicked: create_new</div>
        <div className="p-2 bg-gray-100 rounded">form_submitted: settings</div>
        <div className="p-2 bg-gray-100 rounded text-gray-400">...but did they succeed?</div>
      </div>

      {/* Shift statement */}
      <div className="space-y-3">
        <h2 className="text-xl font-medium">
          Basesignal measures performance
        </h2>
        <p className="text-gray-600">
          Did users reach the outcome that matters? That's your base signal for improvement.
        </p>
      </div>

      {/* Journey visualization */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200">
          <div className="w-2 h-2 rounded-sm bg-gray-400" />
          <span className="text-sm">Signup</span>
        </div>
        <div className="w-8 h-px bg-gray-300" />
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200">
          <div className="w-2 h-2 rounded-sm bg-gray-400" />
          <span className="text-sm">Setup</span>
        </div>
        <div className="w-8 h-px bg-gray-300" />
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200">
          <div className="w-2 h-2 rounded-sm bg-emerald-500" />
          <span className="text-sm font-medium text-gray-900">Activated</span>
        </div>
      </div>

      <Button onClick={onNext} className="w-full">
        Continue
      </Button>
    </div>
  );
}
