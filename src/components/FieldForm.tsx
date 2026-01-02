import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';

interface Field {
  name: string;
  type: string;
  description?: string;
  nullable: boolean;
}

interface FieldFormProps {
  onAdd: (field: Field) => void;
  trigger?: React.ReactNode;
}

export function FieldForm({ onAdd, trigger }: FieldFormProps) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<Field>({
    name: '',
    type: 'string',
    description: '',
    nullable: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(field);
    setOpen(false);
    setField({ name: '', type: 'string', description: '', nullable: false });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Add Field</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm text-gray-600">Name</Label>
            <Input
              id="name"
              value={field.name}
              onChange={(e) => setField({ ...field, name: e.target.value })}
              placeholder="field_name"
              required
            />
          </div>

          <div>
            <Label htmlFor="type" className="text-sm text-gray-600">Type</Label>
            <Select value={field.type} onValueChange={(type) => setField({ ...field, type })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="integer">Integer</SelectItem>
                <SelectItem value="float">Float</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="datetime">Datetime</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm text-gray-600">Description (optional)</Label>
            <Input
              id="description"
              value={field.description}
              onChange={(e) => setField({ ...field, description: e.target.value })}
              placeholder="Field description"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="nullable"
              checked={field.nullable}
              onCheckedChange={(checked) => setField({ ...field, nullable: checked as boolean })}
            />
            <Label htmlFor="nullable" className="text-sm text-gray-600">Nullable</Label>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button type="submit">Add Field</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
