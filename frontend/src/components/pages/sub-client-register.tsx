import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle, Eye, EyeOff, Building2, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/base-path";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

export function SubClientRegisterPage() {
  const { shortPath } = useParams<{ shortPath: string }>();
  const navigate = useNavigate();
  const { setUser, setToken, isAuthenticated } = useAuthStore();

  // Redirect authenticated users to chat
  useEffect(() => {
    if (isAuthenticated) {
      navigate(`/s/${shortPath}/chat`, { replace: true });
    }
  }, [isAuthenticated, shortPath, navigate]);

  // Form state
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      } catch (err) {
        console.error("Failed to load sub-client info", err);
      } finally {
        setIsLoadingSubClient(false);
      }
    };

    if (shortPath) {
      fetchSubClient();
    }
  }, [shortPath]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !username || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        buildApiUrl(`/api/auth/register-subclient/${shortPath}`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            username: username.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Set user session
      setUser(data.user);
      setToken(data.token);

      toast.success("Account created successfully!");

      // Redirect to chat
      navigate(`/s/${shortPath}/chat`);
    } catch (err) {
      console.error("Registration error", err);
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    navigate(`/s/${shortPath}/login`);
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
                Join {subClientName || "Workspace"}
              </h1>
            </>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Create your account to get started
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Registration Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
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
                  autoComplete="new-password"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">
                    {showConfirmPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || isLoadingSubClient}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={handleLogin}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
