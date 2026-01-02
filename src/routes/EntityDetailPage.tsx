import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle } from 'lucide-react'
import { SourcesTab } from '@/components/SourcesTab'
import { ConflictResolutionModal } from '@/components/ConflictResolutionModal'
import { UnifiedFieldsTab } from '@/components/UnifiedFieldsTab'
import { getConflictDetails, resolveConflict, type ConflictDetails } from '@/lib/api'

// Timo org ID from seed
const TIMO_ORG_ID = "j97f5fwqn9hbcw8ngm4ayd0wr17w7kp7" as Id<"orgs">

export default function EntityDetailPage() {
  const { entityName } = useParams()

  // Fetch entity from Convex
  const entity = useQuery(api.entities.getByName, {
    orgId: TIMO_ORG_ID,
    name: entityName || ''
  })

  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<ConflictDetails | null>(null)
  const [isLoadingConflict, setIsLoadingConflict] = useState(false)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)

  // Loading state
  if (entity === undefined) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading entity...</p>
      </div>
    )
  }

  // Error state (entity not found handled by query returning null)
  if (!entity) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Entity not found: {entityName}</p>
        <Link to="/" className="text-blue-600 hover:underline mt-4 block">
          Back to Entities
        </Link>
      </div>
    )
  }

  const handleSave = () => {
    // TODO: Implement Convex mutation when backend is ready
    console.log('Saving entity:', entity.name)
    alert('Changes saved! (Placeholder - will integrate with Convex later)')
  }

  const handleOpenConflictModal = async () => {
    setIsConflictModalOpen(true)
    setIsLoadingConflict(true)
    setConflictError(null)

    try {
      const details = await getConflictDetails('dsd_personal', entityName || '')
      setConflictDetails(details)
    } catch (error) {
      console.error('Failed to load conflict details:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
      setConflictError(errorMsg)
    } finally {
      setIsLoadingConflict(false)
    }
  }

  const handleResolveConflict = async (resolution: 'keep_draft' | 'accept_git') => {
    setIsResolving(true)
    setConflictError(null)

    try {
      const result = await resolveConflict('dsd_personal', entityName || '', resolution)
      alert(`Conflict resolved! Status: ${result.entity_status}`)
      setIsConflictModalOpen(false)
      window.location.reload()
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
      setConflictError(errorMsg)
    } finally {
      setIsResolving(false)
    }
  }

  // Determine status display
  const status = entity.status || 'live'
  const isConflict = status === 'conflict'

  // Get badge color based on status
  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-100 text-green-800 hover:bg-green-100'
      case 'draft': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
      case 'conflict': return 'bg-red-100 text-red-800 hover:bg-red-100'
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100'
    }
  }

  // Prepare source config for SourcesTab
  const sourceConfig = entity.sourceConfig || {
    type: entity.sourceType || 'unknown',
  }

  // Count fields for metadata display
  const fieldCount = (entity.sourceMapping?.fieldMappingsList?.length || 0) +
                     (entity.computedColumns?.length || 0)

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-900">Entities</Link>
        <span>/</span>
        <span className="text-gray-900">{entity.name}</span>
      </div>

      {/* Entity header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-medium text-gray-900">{entity.name}</h1>
            <Badge className={getBadgeClass(status)}>
              {status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">Source: {entity.sourceType}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="font-mono">ID: {entity._id}</span>
            <span className="font-mono">{fieldCount} fields</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={handleSave}
                    disabled={isConflict}
                  >
                    {isConflict ? 'Deploy Blocked' : 'Save Changes'}
                  </Button>
                </div>
              </TooltipTrigger>
              {isConflict && (
                <TooltipContent>
                  <p>Resolve the conflict before deploying</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Conflict warning banner */}
      {isConflict && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Merge Conflict Detected</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              This entity has conflicting changes between your draft and the latest Git version.
              You must resolve the conflict before deploying.
            </span>
            <Button
              onClick={handleOpenConflictModal}
              variant="outline"
              size="sm"
            >
              Resolve Conflict
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for different views - Entity first, Sources second */}
      <Tabs defaultValue="entity" className="w-full">
        <TabsList>
          <TabsTrigger value="entity">Entity</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="entity" className="mt-6">
          <UnifiedFieldsTab
            fieldMappings={entity.sourceMapping?.fieldMappingsList}
            computedColumns={entity.computedColumns || []}
            tenantId={entity.tenantExtension?.tenantId}
          />
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          <SourcesTab
            sourceConfig={sourceConfig}
            sourceFields={entity.fields || []}
          />
        </TabsContent>
      </Tabs>

      <ConflictResolutionModal
        isOpen={isConflictModalOpen}
        onClose={() => {
          setIsConflictModalOpen(false)
          setConflictError(null)
        }}
        entityName={entity.name}
        onResolve={handleResolveConflict}
        conflictDetails={conflictDetails}
        isLoadingConflict={isLoadingConflict}
        errorMessage={conflictError}
        isResolving={isResolving}
      />
    </div>
  )
}
