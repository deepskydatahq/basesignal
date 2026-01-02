import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import type { ConflictDetails } from '@/lib/api'

// Update props interface
interface ConflictResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  entityName: string
  onResolve: (resolution: 'keep_draft' | 'accept_git') => void
  conflictDetails: ConflictDetails | null
  isLoadingConflict: boolean
  errorMessage: string | null
  isResolving: boolean
}

// Add DiffView component inside the file (above ConflictResolutionModal)
function DiffView({
  conflictingFields,
  draftChanges,
  liveChanges
}: {
  conflictingFields: string[]
  draftChanges: Record<string, any>
  liveChanges: Record<string, any>
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700">
        Conflicting Fields ({conflictingFields.length})
      </div>

      {conflictingFields.map((field) => (
        <div key={field} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <code className="text-sm font-mono text-gray-700">{field}</code>
          </div>

          <div className="grid grid-cols-2 divide-x">
            {/* Draft version (left) */}
            <div className="p-4 bg-blue-50">
              <div className="text-xs font-medium text-blue-900 mb-2">
                Your Draft
              </div>
              <pre className="text-sm font-mono text-blue-900 whitespace-pre-wrap break-words">
                {JSON.stringify(draftChanges[field], null, 2)}
              </pre>
            </div>

            {/* Git version (right) */}
            <div className="p-4 bg-green-50">
              <div className="text-xs font-medium text-green-900 mb-2">
                Git Version
              </div>
              <pre className="text-sm font-mono text-green-900 whitespace-pre-wrap break-words">
                {JSON.stringify(liveChanges[field], null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Update ConflictResolutionModal component
export function ConflictResolutionModal({
  isOpen,
  onClose,
  entityName,
  onResolve,
  conflictDetails,
  isLoadingConflict,
  errorMessage,
  isResolving,
}: ConflictResolutionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Resolve Conflict: {entityName}
          </DialogTitle>
          <DialogDescription>
            Your draft and the latest Git version both modified the same fields.
            Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        {/* Diff view with error handling */}
        <div className="py-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : isLoadingConflict ? (
            <div className="text-center py-8 text-gray-500">
              Loading conflict details...
            </div>
          ) : conflictDetails?.has_conflict ? (
            <DiffView
              conflictingFields={conflictDetails.conflicting_fields}
              draftChanges={conflictDetails.draft_changes}
              liveChanges={conflictDetails.live_changes}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              No conflict details available
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isResolving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onResolve('accept_git')}
            disabled={isLoadingConflict || !conflictDetails?.has_conflict || isResolving || !!errorMessage}
          >
            {isResolving ? 'Resolving...' : 'Accept Git Changes (Discard Draft)'}
          </Button>
          <Button
            onClick={() => onResolve('keep_draft')}
            disabled={isLoadingConflict || !conflictDetails?.has_conflict || isResolving || !!errorMessage}
          >
            {isResolving ? 'Resolving...' : 'Keep My Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
