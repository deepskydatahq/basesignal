import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Configure your data platform settings</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Manage your organization settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Organization Name</p>
                <p className="text-sm text-gray-600 mt-1">Timo Data Platform</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Repository</p>
                <p className="text-sm text-gray-600 mt-1">https://github.com/timo/tenant-timo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GitHub Integration</CardTitle>
            <CardDescription>
              Configure GitHub repository settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">GitHub integration settings will be available here</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BigQuery Configuration</CardTitle>
            <CardDescription>
              Configure BigQuery connection settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Project ID</p>
                <p className="text-sm text-gray-600 mt-1">deepskydata</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Dataset</p>
                <p className="text-sm text-gray-600 mt-1">timodata_model_dev</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
