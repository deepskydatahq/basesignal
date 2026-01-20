import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { PRIMITIVES, getPrimitiveByName } from '../lib/primitives';
import { Code } from './ui/code';

interface ComputedColumn {
  name: string;
  primitiveName: string;
  params: Record<string, unknown>;
  sql: string;
}

interface ComputedColumnFormProps {
  fields: Array<{ name: string }>;
  onAdd: (column: ComputedColumn) => void;
}

export function ComputedColumnForm({ fields, onAdd }: ComputedColumnFormProps) {
  const [open, setOpen] = useState(false);
  const [columnName, setColumnName] = useState('');
  const [primitiveName, setPrimitiveName] = useState('');
  const [params, setParams] = useState<Record<string, unknown>>({});

  const selectedPrimitive = getPrimitiveByName(primitiveName);
  const generatedSQL = selectedPrimitive ? selectedPrimitive.generateSQL(params) : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrimitive) return;

    onAdd({
      name: columnName,
      primitiveName,
      params,
      sql: generatedSQL,
    });

    setOpen(false);
    setColumnName('');
    setPrimitiveName('');
    setParams({});
  };

  const handleParamChange = (paramName: string, value: unknown) => {
    setParams({ ...params, [paramName]: value });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Computed Column</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Computed Column</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="columnName" className="text-sm text-gray-600">Column Name</Label>
            <Input
              id="columnName"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              placeholder="computed_field_name"
              required
            />
          </div>

          <div>
            <Label htmlFor="primitive" className="text-sm text-gray-600">Primitive</Label>
            <Select value={primitiveName} onValueChange={setPrimitiveName}>
              <SelectTrigger>
                <SelectValue placeholder="Select primitive" />
              </SelectTrigger>
              <SelectContent>
                {PRIMITIVES.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.label} - {p.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPrimitive && (
            <div className="space-y-3 border rounded p-4">
              <h4 className="font-medium text-sm">Parameters</h4>
              {selectedPrimitive.params.map((param) => (
                <div key={param.name}>
                  <Label htmlFor={param.name} className="text-sm text-gray-600">
                    {param.name} {param.required && '*'}
                  </Label>
                  {param.type === 'column_select' ? (
                    <Select
                      value={params[param.name] || ''}
                      onValueChange={(v) => handleParamChange(param.name, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.name} value={f.name}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={param.name}
                      value={params[param.name] || ''}
                      onChange={(e) => handleParamChange(param.name, e.target.value)}
                      placeholder={param.description || param.name}
                      required={param.required}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {generatedSQL && (
            <div>
              <Label className="text-sm text-gray-600">Generated SQL (preview)</Label>
              <Code className="block mt-2 p-3 bg-muted rounded">
                {generatedSQL}
              </Code>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <Button type="submit" disabled={!primitiveName}>Add Computed Column</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
