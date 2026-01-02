import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";

// Standard Amplitude fields that can identify an account
const STANDARD_ID_FIELDS = [
  { value: "user_id", label: "User ID" },
  { value: "device_id", label: "Device ID" },
];

export default function AccountMappingPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();

  const connection = useQuery(api.amplitude.getById, {
    id: connectionId as Id<"amplitudeConnections">
  });
  const existingMapping = useQuery(api.accountMappings.getByConnection, {
    connectionId: connectionId as Id<"amplitudeConnections">,
  });

  const createMapping = useMutation(api.accountMappings.create);
  const updateMapping = useMutation(api.accountMappings.update);

  const [accountIdField, setAccountIdField] = useState("user_id");
  const [isSaving, setIsSaving] = useState(false);

  // Load existing mapping
  useEffect(() => {
    if (existingMapping) {
      setAccountIdField(existingMapping.accountIdField);
    }
  }, [existingMapping]);

  const handleSave = async () => {
    if (!connectionId) return;

    setIsSaving(true);
    try {
      if (existingMapping) {
        await updateMapping({
          id: existingMapping._id,
          accountIdField,
        });
      } else {
        await createMapping({
          connectionId: connectionId as Id<"amplitudeConnections">,
          accountIdField,
          fieldMappings: [], // Empty for now, will add field mapping UI later
        });
      }
      navigate(`/sources/amplitude/${connectionId}/activities`);
    } catch (error) {
      console.error("Failed to save mapping:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!connection) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate(`/sources/amplitude/${connectionId}/confirm`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Connection
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Configure Account Identity</CardTitle>
          <CardDescription>
            Choose how to identify unique accounts from your Amplitude data.
            This field will be used to group events by account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="accountIdField">Account Identifier Field</Label>
            <Select value={accountIdField} onValueChange={setAccountIdField}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_ID_FIELDS.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Most commonly, this is "User ID" if your product has user accounts.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save & Continue to Activities"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
