import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

import { EntityCard } from '@/components/EntityCard'
import { Button } from '@/components/ui/button'

// Hardcoded org ID matching the sync script
const TIMO_ORG_ID = "j97f5fwqn9hbcw8ngm4ayd0wr17w7kp7" as Id<"orgs">

export default function EntitiesListPage() {
  const entities = useQuery(api.entities.list, { orgId: TIMO_ORG_ID })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Entities</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your data platform entity definitions</p>
        </div>
        <Button>Create Entity</Button>
      </div>

      {!entities ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Loading entities...</p>
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No entities found. Run the seed script to populate data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entities.map((entity) => (
            <EntityCard
              key={entity._id}
              name={entity.name}
              sourceType={entity.sourceType}
              fieldCount={entity.fieldCount}
              status={entity.status}
            />
          ))}
        </div>
      )}
    </div>
  )
}
