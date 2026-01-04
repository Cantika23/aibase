import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface SetupData {
  appName: string;
  hasLogo: boolean;
  updatedAt: number;
}

export function AdminSetupPage() {
  const [licenseKey, setLicenseKey] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [appName, setAppName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current setup on mount
  useEffect(() => {
    loadSetup();
  }, []);

  const loadSetup = async () => {
    try {
      const response = await fetch("/api/admin/setup");
      const data = await response.json();

      if (data.success) {
        setSetup(data.setup);
        if (data.setup?.appName) {
          setAppName(data.setup.appName);
        }
      }
    } catch (err) {
      console.error("Error loading setup:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/setup/verify-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await response.json();

      if (data.success) {
        setIsVerified(true);
        toast.success("License key verified successfully");
      } else {
        setError(data.error || "Invalid license key");
        toast.error(data.error || "Invalid license key");
      }
    } catch (err) {
      const errorMsg = "Failed to verify license key";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setVerifying(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("licenseKey", licenseKey);
      if (appName) {
        formData.append("appName", appName);
      }
      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const response = await fetch("/api/admin/setup", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSetup(data.setup);
        toast.success("Setup saved successfully!");
        // Reload the page to apply changes
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setError(data.error || "Failed to save setup");
        toast.error(data.error || "Failed to save setup");
      }
    } catch (err) {
      const errorMsg = "Failed to save setup";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            {setup?.appName || "Admin Setup"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure your application settings
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isVerified ? (
          <div className="space-y-6">
            <Alert>
              <AlertCircle />
              <AlertTitle>License Key Required</AlertTitle>
              <AlertDescription>
                Enter your OPENAI_API_KEY environment variable as the license key
                to access admin setup.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleVerifyLicense} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License Key</Label>
                <Input
                  id="licenseKey"
                  type="password"
                  placeholder="Enter your OPENAI_API_KEY"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  This is the value of OPENAI_API_KEY from your .env file
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={verifying}>
                {verifying ? "Verifying..." : "Verify License Key"}
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <Alert>
              <CheckCircle2 />
              <AlertTitle>License Verified</AlertTitle>
              <AlertDescription>
                You can now modify your application settings
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSaveSetup} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="appName">Application Name</Label>
                <Input
                  id="appName"
                  type="text"
                  placeholder="Enter application name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This will override the APP_NAME environment variable
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Application Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                  </div>
                  {logoPreview && (
                    <div className="relative h-16 w-16 border rounded-md overflow-hidden">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  {(setup?.hasLogo || logoPreview) && !logoPreview && (
                    <div className="h-16 w-16 border rounded-md flex items-center justify-center bg-muted">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a logo image (PNG, JPG, etc.) - will be saved to /data/logo.png
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsVerified(false);
                  setLicenseKey("");
                }}
              >
                Change License Key
              </Button>
            </form>

            {setup?.updatedAt && (
              <div className="text-center text-xs text-muted-foreground">
                Last updated: {new Date(setup.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
