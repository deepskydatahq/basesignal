import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Code } from './ui/code';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, ChevronRight, User } from 'lucide-react';

/**
 * Represents a tenant-specific computed column configuration
 */
interface TenantComputedColumn {
  name: string;
  primitiveName: string;
  params: Record<string, unknown>;
  sql: string;
}

/**
 * Represents a tenant-specific measure configuration
 */
interface TenantMeasure {
  name: string;
  expression: string;
}

/**
 * Structure of the tenant extension data
 */
interface TenantExtension {
  tenantId: string;
  tenantComputedColumns?: TenantComputedColumn[];
  tenantMeasures?: TenantMeasure[];
}

/**
 * Props for the TenantExtensionSection component
 */
interface TenantExtensionSectionProps {
  tenantExtension?: TenantExtension;
}

/**
 * Displays tenant-specific extensions including computed columns and measures.
 *
 * This component shows tenant-specific customizations that extend the base entity
 * definition. It uses green styling to differentiate tenant extensions from base
 * entity configurations.
 *
 * @param tenantExtension - Optional tenant extension data containing tenant ID,
 *                          computed columns, and measures
 * @returns A collapsible section with tenant extensions, or null if no tenant data
 *
 * @example
 * ```tsx
 * <TenantExtensionSection
 *   tenantExtension={{
 *     tenantId: "acme_corp",
 *     tenantComputedColumns: [{
 *       name: "custom_score",
 *       primitiveName: "categorize",
 *       params: { thresholds: [0, 50, 100] },
 *       sql: "CASE WHEN score < 50 THEN 'low' ELSE 'high' END"
 *     }],
 *     tenantMeasures: [{
 *       name: "total_revenue",
 *       expression: "SUM(amount)"
 *     }]
 *   }}
 * />
 * ```
 */
export function TenantExtensionSection({ tenantExtension }: TenantExtensionSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Return null if no tenant extension data
  if (!tenantExtension) {
    return null;
  }

  const { tenantId, tenantComputedColumns = [], tenantMeasures = [] } = tenantExtension;

  // Don't render if there are no tenant customizations
  const hasCustomizations = tenantComputedColumns.length > 0 || tenantMeasures.length > 0;
  if (!hasCustomizations) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-green-50 border border-green-200 rounded-t-lg hover:bg-green-100 transition-colors">
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-green-700" />
        ) : (
          <ChevronRight className="h-4 w-4 text-green-700" />
        )}
        <User className="h-4 w-4 text-green-700" />
        <span className="font-medium text-green-900">Tenant Extensions</span>
        <Badge className="ml-2 bg-green-600 hover:bg-green-700">{tenantId}</Badge>
        <span className="ml-auto text-sm text-green-700">
          {tenantComputedColumns.length + tenantMeasures.length} customizations
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-x border-b border-green-200 rounded-b-lg">
        <div className="p-4 space-y-6">
          {/* Tenant Computed Columns */}
          {tenantComputedColumns.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-3">
                Tenant Computed Columns ({tenantComputedColumns.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Primitive</TableHead>
                    <TableHead>Parameters</TableHead>
                    <TableHead>SQL Expression</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantComputedColumns.map((column, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Code>{column.name}</Code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{column.primitiveName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Code className="text-xs">
                          {JSON.stringify(column.params)}
                        </Code>
                      </TableCell>
                      <TableCell>
                        <Code className="text-xs break-all">{column.sql}</Code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Tenant Measures */}
          {tenantMeasures.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-3">
                Tenant Measures ({tenantMeasures.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Expression</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantMeasures.map((measure, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Code>{measure.name}</Code>
                      </TableCell>
                      <TableCell>
                        <Code className="text-xs break-all">{measure.expression}</Code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
