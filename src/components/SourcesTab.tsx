import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface SourceField {
  name: string;
  type: string;
  description?: string;
  nullable: boolean;
}

interface SourceConfig {
  type: string;
  project?: string;
  dataset?: string;
  table?: string;
  duckdbPath?: string;
}

interface SourcesTabProps {
  sourceConfig: SourceConfig;
  sourceFields: SourceField[];
}

export function SourcesTab({ sourceConfig, sourceFields }: SourcesTabProps) {
  return (
    <div className="space-y-6">
      {/* Source Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Source Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-mono mt-1">
                <Badge variant="outline">{sourceConfig.type}</Badge>
              </dd>
            </div>
            {sourceConfig.project && (
              <div>
                <dt className="text-muted-foreground">Project</dt>
                <dd className="font-mono mt-1">{sourceConfig.project}</dd>
              </div>
            )}
            {sourceConfig.dataset && (
              <div>
                <dt className="text-muted-foreground">Dataset</dt>
                <dd className="font-mono mt-1">{sourceConfig.dataset}</dd>
              </div>
            )}
            {sourceConfig.table && (
              <div>
                <dt className="text-muted-foreground">Table</dt>
                <dd className="font-mono mt-1">{sourceConfig.table}</dd>
              </div>
            )}
            {sourceConfig.duckdbPath && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">DuckDB Path</dt>
                <dd className="font-mono mt-1 text-xs break-all">{sourceConfig.duckdbPath}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Source Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Source Fields
            <Badge variant="secondary" className="ml-2">
              {sourceFields.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sourceFields.length === 0 ? (
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
        </CardContent>
      </Card>
    </div>
  );
}
