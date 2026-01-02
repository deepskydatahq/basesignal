import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Field mapping entry that maps an entity field to a source field
 */
interface FieldMapping {
  entityField: string;
  sourceField: string;
}

/**
 * Props for the FieldMappingsSection component
 */
interface FieldMappingsSectionProps {
  /**
   * Optional array of field mappings. If not provided or empty, the component renders nothing.
   */
  fieldMappings?: Array<FieldMapping>;
}

/**
 * Displays field mappings in a collapsible section with a table showing the mapping
 * from source fields to entity fields.
 *
 * @example
 * ```tsx
 * <FieldMappingsSection
 *   fieldMappings={[
 *     { entityField: 'customer_id', sourceField: 'user_id' },
 *     { entityField: 'email', sourceField: 'email_address' }
 *   ]}
 * />
 * ```
 *
 * @param props - Component props
 * @returns The collapsible field mappings section, or null if no mappings provided
 */
export function FieldMappingsSection({ fieldMappings }: FieldMappingsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Return null if no field mappings or empty array
  if (!fieldMappings || fieldMappings.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-transparent">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <h3 className="text-lg font-medium">
                Field Mappings
                <Badge variant="secondary" className="ml-2">
                  {fieldMappings.length}
                </Badge>
              </h3>
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Field</TableHead>
                  <TableHead className="w-12 text-center"></TableHead>
                  <TableHead>Source Field</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldMappings.map((mapping, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">{mapping.entityField}</TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground inline-block" />
                    </TableCell>
                    <TableCell className="font-mono">{mapping.sourceField}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
