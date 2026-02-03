import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle, Eye, EyeOff, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { buildApiUrl } from "@/lib/base-path";

export function SubClientLoginPage() {
  const auth = useAuth();
  const { shortPath } = useParams<{ shortPath: string }>();
  const navigate = useNavigate();

  // Redirect authenticated users to chat
  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      navigate(`/s/${shortPath}/chat`, { replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, shortPath, navigate]);

  // Form state
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [subClientName, setSubClientName] = useState<string>("");
  const [isLoadingSubClient, setIsLoadingSubClient] = useState(true);

  // Load sub-client info
  useEffect(() => {
    const fetchSubClient = async () => {
      try {
        const response = await fetch(
          buildApiUrl(`/api/sub-clients/lookup?shortPath=${encodeURIComponent(shortPath!)}`)
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.subClient) {
            setSubClientName(data.data.subClient.name);
          }
        }
      } catch (error) {
        console.error("Failed to load sub-client info", error);
      } finally {
        setIsLoadingSubClient(false);
      }
    };

    if (shortPath) {
      fetchSubClient();
    }
  }, [shortPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await auth.login(emailOrUsername, password);
    if (success) {
      // Redirect to sub-client chat after successful login
      navigate(`/s/${shortPath}/chat`);
    }
  };

  const handleRegister = () => {
    navigate(`/s/${shortPath}/register`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          {!isLoadingSubClient && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                {subClientName || "Workspace"}
              </h1>
            </>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your workspace
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {auth.error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Login Failed</AlertTitle>
              <AlertDescription>
                {auth.error === "Failed to fetch"
                  ? "Unable to connect to the server. Please check if the backend is running."
                  : auth.error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailOrUsername">Email or Username</Label>
              <Input
                id="emailOrUsername"
                type="text"
                placeholder="Enter your email or username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={auth.isLoading || isLoadingSubClient}>
              {auth.isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={handleRegister}
                className="text-primary hover:underline"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
