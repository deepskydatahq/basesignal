import { Badge } from './ui/badge';

interface ComputedColumnOriginBadgeProps {
  origin?: string;
}

/**
 * Displays a colored badge indicating the origin of a computed column.
 * - core: Global entity definition (blue)
 * - layer: Layer-specific (prep/dimension) (purple)
 * - tenant: Tenant-specific extension (green)
 */
export function ComputedColumnOriginBadge({ origin }: ComputedColumnOriginBadgeProps) {
  const getOriginStyle = (origin?: string) => {
    switch (origin) {
      case 'core':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'layer':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
      case 'tenant':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  const getOriginLabel = (origin?: string) => {
    switch (origin) {
      case 'core':
        return 'Core';
      case 'layer':
        return 'Layer';
      case 'tenant':
        return 'Tenant';
      default:
        return 'Unknown';
    }
  };

  return (
    <Badge className={`text-xs ${getOriginStyle(origin)}`}>
      {getOriginLabel(origin)}
    </Badge>
  );
}
