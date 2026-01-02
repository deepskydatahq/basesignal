import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Code } from './ui/code';
import { ComputedColumnForm } from './ComputedColumnForm';

interface ComputedColumn {
  name: string;
  primitiveName: string;
  params: Record<string, any>;
  sql: string;
}

interface ComputedColumnsTabProps {
  fields: Array<{ name: string }>;
  computedColumns: ComputedColumn[];
  onAddColumn: (column: ComputedColumn) => void;
  onRemoveColumn: (index: number) => void;
}

export function ComputedColumnsTab({
  fields,
  computedColumns,
  onAddColumn,
  onRemoveColumn
}: ComputedColumnsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Computed Columns</h3>
        <ComputedColumnForm fields={fields} onAdd={onAddColumn} />
      </div>

      {computedColumns.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No computed columns. Add one using primitives.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Primitive</TableHead>
              <TableHead>SQL Expression</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {computedColumns.map((column, index) => (
              <TableRow key={index}>
                <TableCell className="font-mono">{column.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{column.primitiveName}</Badge>
                </TableCell>
                <TableCell>
                  <Code className="text-xs">{column.sql}</Code>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveColumn(index)}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
