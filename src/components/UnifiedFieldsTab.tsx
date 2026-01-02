import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Field mapping entry from SourceMapping
 */
interface FieldMapping {
  entityField: string;
  sourceField: string;
}

/**
 * Computed column with origin tracking
 */
interface ComputedColumn {
  name: string;
  primitiveName: string;
  params: Record<string, unknown>;
  sql: string;
  origin?: string; // 'core', 'layer', or 'tenant'
}

/**
 * Unified field representation combining mapped and computed fields
 */
interface UnifiedField {
  name: string;
  source: string; // "mapped: source_field" or "computed: expression"
  type: 'mapped' | 'computed';
  origin?: string; // 'core', 'layer', or 'tenant' for computed fields
  description?: string;
}

interface UnifiedFieldsTabProps {
  fieldMappings?: FieldMapping[];
  computedColumns?: ComputedColumn[];
  tenantId?: string;
}

/**
 * Displays entity fields in a unified view with Core Fields and Extended Fields sections.
 *
 * Core Fields: Mapped source fields + core computed columns
 * Extended Fields: Tenant-specific computed columns (layer + tenant origin)
 */
export function UnifiedFieldsTab({ fieldMappings = [], computedColumns = [], tenantId }: UnifiedFieldsTabProps) {
  const [coreFieldsOpen, setCoreFieldsOpen] = useState(true);
  const [extendedFieldsOpen, setExtendedFieldsOpen] = useState(true);

  // Build unified field lists
  const coreFields: UnifiedField[] = [];
  const extendedFields: UnifiedField[] = [];

  // Add mapped fields to core
  for (const mapping of fieldMappings) {
    coreFields.push({
      name: mapping.entityField,
      source: `mapped: ${mapping.sourceField}`,
      type: 'mapped',
    });
  }

  // Separate computed columns by origin
  for (const col of computedColumns) {
    const field: UnifiedField = {
      name: col.name,
      source: `computed: ${col.sql || col.primitiveName}`,
      type: 'computed',
      origin: col.origin,
    };

    if (col.origin === 'core' || !col.origin) {
      // Core computed columns go with core fields
      coreFields.push(field);
    } else {
      // Layer and tenant computed columns are extended
      extendedFields.push(field);
    }
  }

  // Get badge styling based on field type and origin
  const getSourceBadge = (field: UnifiedField) => {
    if (field.type === 'mapped') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{field.source}</Badge>;
    }

    // Computed fields - style by origin
    const originColors: Record<string, string> = {
      core: 'bg-gray-50 text-gray-700 border-gray-200',
      layer: 'bg-purple-50 text-purple-700 border-purple-200',
      tenant: 'bg-green-50 text-green-700 border-green-200',
    };
    const colorClass = originColors[field.origin || 'core'] || originColors.core;

    return <Badge variant="outline" className={colorClass}>{field.source}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Core Fields Section */}
      <Collapsible open={coreFieldsOpen} onOpenChange={setCoreFieldsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-t-lg hover:bg-muted transition-colors">
          {coreFieldsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">Core Fields</span>
          <Badge variant="secondary" className="ml-2">
            {coreFields.length}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            Required/optional fields from global entity + core computed
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-lg">
            {coreFields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No core fields defined.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Field Name</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coreFields.map((field, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono font-medium">{field.name}</TableCell>
                      <TableCell>
                        {getSourceBadge(field)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Extended Fields Section */}
      {extendedFields.length > 0 && (
        <Collapsible open={extendedFieldsOpen} onOpenChange={setExtendedFieldsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-green-50 border border-green-200 rounded-t-lg hover:bg-green-100 transition-colors">
            {extendedFieldsOpen ? (
              <ChevronDown className="h-4 w-4 text-green-700" />
            ) : (
              <ChevronRight className="h-4 w-4 text-green-700" />
            )}
            <span className="font-medium text-green-900">Extended Fields</span>
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
              {extendedFields.length}
            </Badge>
            {tenantId && (
              <Badge className="ml-2 bg-green-600 hover:bg-green-700">{tenantId}</Badge>
            )}
            <span className="ml-auto text-xs text-green-700">
              Tenant-specific computed columns
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-x border-b border-green-200 rounded-b-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Field Name</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extendedFields.map((field, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono font-medium">{field.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{field.source}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
