import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Code } from './ui/code';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ComputedColumnOriginBadge } from './ComputedColumnOriginBadge';

interface SourceField {
  name: string;
  type: string;
  description?: string;
  nullable: boolean;
}

interface ComputedColumn {
  name: string;
  primitiveName: string;
  params: Record<string, unknown>;
  sql: string;
  origin?: string;
}

interface EntityFieldsTabProps {
  sourceFields: SourceField[];
  computedColumns: ComputedColumn[];
}

export function EntityFieldsTab({ sourceFields, computedColumns }: EntityFieldsTabProps) {
  const [sourceFieldsOpen, setSourceFieldsOpen] = useState(true);
  const [computedFieldsOpen, setComputedFieldsOpen] = useState(true);

  return (
    <div className="space-y-4">
      {/* Source Fields Section */}
      <Collapsible open={sourceFieldsOpen} onOpenChange={setSourceFieldsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-t-lg hover:bg-muted transition-colors">
          {sourceFieldsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">Source Fields</span>
          <Badge variant="secondary" className="ml-2">
            {sourceFields.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-lg">
            {sourceFields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No source fields defined.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Nullable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceFields.map((field, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{field.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{field.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {field.description || '-'}
                      </TableCell>
                      <TableCell>
                        {field.nullable ? '✓' : '✗'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Computed Fields Section */}
      <Collapsible open={computedFieldsOpen} onOpenChange={setComputedFieldsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-t-lg hover:bg-muted transition-colors">
          {computedFieldsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">Computed Fields</span>
          <Badge variant="secondary" className="ml-2">
            {computedColumns.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-lg">
            {computedColumns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No computed fields defined.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Primitive</TableHead>
                    <TableHead>SQL Expression</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedColumns.map((column, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{column.name}</TableCell>
                      <TableCell>
                        <ComputedColumnOriginBadge origin={column.origin} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{column.primitiveName || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Code className="text-xs">{column.sql}</Code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
