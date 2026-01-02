import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AmplitudeConnectPage() {
  const navigate = useNavigate();
  const testConnection = useAction(api.amplitudeActions.testConnection);
  const createConnection = useMutation(api.amplitude.create);

  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setValidated(false);

    try {
      const result = await testConnection({ apiKey, secretKey });
      if (result.success) {
        setValidated(true);
      } else {
        setError(result.error || "Connection test failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validated) {
      setError("Please test the connection first");
      return;
    }

    try {
      const id = await createConnection({ name, apiKey, secretKey });
      navigate(`/sources/amplitude/${id}/events`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connection");
    }
  };

  const isFormValid = name.trim() && apiKey.trim() && secretKey.trim();

  return (
    <div className="container mx-auto py-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Connect Amplitude</CardTitle>
          <CardDescription>
            Enter your Amplitude API credentials to connect your project.
            You can find these in Amplitude under Settings → Projects → API Keys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="My Amplitude Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter API Key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setValidated(false);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Key</Label>
              <Input
                id="secretKey"
                type="password"
                placeholder="Enter Secret Key"
                value={secretKey}
                onChange={(e) => {
                  setSecretKey(e.target.value);
                  setValidated(false);
                }}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {validated && (
              <Alert>
                <AlertDescription className="text-green-600">
                  Connection validated successfully!
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={!apiKey || !secretKey || testing}
              >
                {testing ? "Testing..." : "Test Connection"}
              </Button>
              <Button type="submit" disabled={!isFormValid || !validated}>
                Continue
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
