import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";

interface StageDetailPanelProps {
  stage: {
    _id: string;
    name: string;
    type: string;
  };
  onUpdate: (name: string, type: string) => void;
  onDelete: () => void;
  onClose: () => void;
  valueRuleName?: string;
}

export default function StageDetailPanel({
  stage,
  onUpdate,
  onDelete,
  onClose,
  valueRuleName,
}: StageDetailPanelProps) {
  const [name, setName] = useState(stage.name);
  const [type, setType] = useState(stage.type);

  useEffect(() => {
    setName(stage.name);
    setType(stage.type);
  }, [stage]);

  const handleNameBlur = () => {
    if (name.trim() && name !== stage.name) {
      onUpdate(name.trim(), type);
    }
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    onUpdate(name, newType);
  };

  const handleDelete = () => {
    if (confirm("Delete this stage and its connections?")) {
      onDelete();
    }
  };

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg z-10">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Stage Details</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="entry">Entry</option>
            <option value="activity">Activity</option>
          </select>
        </div>

        {valueRuleName && (
          <>
            <hr className="border-gray-200" />
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-full" />
              <span className="text-gray-600">Used in: {valueRuleName}</span>
            </div>
          </>
        )}

        <hr className="border-gray-200" />

        <button
          onClick={handleDelete}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
          Delete Stage
        </button>
      </div>
    </div>
  );
}
