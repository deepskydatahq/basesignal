import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { FieldForm } from './FieldForm';

interface Field {
  name: string;
  type: string;
  description?: string;
  nullable: boolean;
}

interface FieldsTabProps {
  fields: Field[];
  onAddField: (field: Field) => void;
  onRemoveField: (index: number) => void;
}

export function FieldsTab({ fields, onAddField, onRemoveField }: FieldsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Fields</h3>
        <FieldForm onAdd={onAddField} />
      </div>

      {fields.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No source fields defined. Add fields to the entity source definition.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Nullable</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
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
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveField(index)}
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
