import { Link } from 'react-router-dom'

interface EntityCardProps {
  name: string
  sourceType: string
  fieldCount: number
  status: string
  description?: string
}

export function EntityCard({ name, sourceType, fieldCount, status, description }: EntityCardProps) {
  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-0.5 rounded text-xs font-medium"
    switch (status) {
      case 'synced':
        return <span className={`${baseClasses} bg-green-50 text-green-700`}>Synced</span>
      case 'pending':
        return <span className={`${baseClasses} bg-yellow-50 text-yellow-700`}>Pending</span>
      case 'failed':
        return <span className={`${baseClasses} bg-red-50 text-red-700`}>Failed</span>
      case 'conflict':
        return <span className={`${baseClasses} bg-orange-50 text-orange-700`}>Conflict</span>
      default:
        return <span className={`${baseClasses} bg-gray-50 text-gray-600 border border-gray-200`}>{status}</span>
    }
  }

  return (
    <Link to={`/entities/${name}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-medium text-gray-900">{name}</h3>
          {getStatusBadge(status)}
        </div>
        {description && (
          <p className="text-sm text-gray-500 mb-4">{description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="font-mono">{fieldCount} fields</span>
          <span className="font-mono">{sourceType}</span>
        </div>
      </div>
    </Link>
  )
}
