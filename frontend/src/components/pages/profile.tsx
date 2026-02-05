import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle, Eye, EyeOff, ArrowLeft, CheckCircle2, User, Mail, Pencil, X, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

export function ProfilePage() {
  const auth = useAuth();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  if (!auth.isAuthenticated && !auth.isLoading) {
    navigate("/login", { replace: true });
    return null;
  }

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateForm = (): string | null => {
    if (!currentPassword) {
      return "Current password is required";
    }
    if (!newPassword) {
      return "New password is required";
    }
    if (newPassword.length < 8) {
      return "New password must be at least 8 characters long";
    }
    if (newPassword.length > 128) {
      return "New password must be less than 128 characters";
    }
    if (newPassword === currentPassword) {
      return "New password must be different from current password";
    }
    if (newPassword !== confirmPassword) {
      return "New passwords do not match";
    }
    return null;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSuccess(false);

    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    const success = await auth.changePassword(currentPassword, newPassword);

    if (success) {
      setIsSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    } else {
      setFormError(auth.error || "Failed to change password");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setIsSavingProfile(true);

    // Validate profile form
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (profileForm.email && !emailRegex.test(profileForm.email)) {
      setProfileError("Invalid email format");
      setIsSavingProfile(false);
      return;
    }

    if (profileForm.username && profileForm.username.length < 3) {
      setProfileError("Username must be at least 3 characters long");
      setIsSavingProfile(false);
      return;
    }

    if (profileForm.username && profileForm.username.length > 50) {
      setProfileError("Username must be less than 50 characters");
      setIsSavingProfile(false);
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (profileForm.username && !usernameRegex.test(profileForm.username)) {
      setProfileError("Username can only contain letters, numbers, underscores, and hyphens");
      setIsSavingProfile(false);
      return;
    }

    // Check if anything changed
    if (profileForm.username === user?.username && profileForm.email === user?.email) {
      setProfileError("No changes to save");
      setIsSavingProfile(false);
      return;
    }

    const success = await auth.updateProfile({
      email: profileForm.email !== user?.email ? profileForm.email : undefined,
      username: profileForm.username !== user?.username ? profileForm.username : undefined,
    });

    if (success) {
      setIsEditingProfile(false);
      toast.success("Profile updated successfully");
    } else {
      setProfileError(auth.error || "Failed to update profile");
    }

    setIsSavingProfile(false);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setProfileForm({
      username: user?.username || "",
      email: user?.email || "",
    });
    setProfileError(null);
  };

  const handleStartEdit = () => {
    setIsEditingProfile(true);
    setProfileForm({
      username: user?.username || "",
      email: user?.email || "",
    });
    setProfileError(null);
  };

  if (auth.isLoading) {
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
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="w-full max-w-2xl space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your account settings</p>
          </div>
        </div>

        {/* User Info Card */}
        <div className="border rounded-lg p-6 bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Account Information</h2>
            {!isEditingProfile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>

          {profileError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          )}

          {!isEditingProfile ? (
            // Read-only view
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Username</p>
                  <p className="text-sm text-muted-foreground">{user?.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <AlertCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Role</p>
                  <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
                </div>
              </div>
            </div>
          ) : (
            // Edit mode
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  placeholder="Enter username"
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  3-50 characters, letters, numbers, underscores, and hyphens only
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="Enter email"
                  className="max-w-md"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSavingProfile ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSavingProfile}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Change Password Form */}
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>

          {isSuccess && (
            <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Your password has been changed successfully.
              </AlertDescription>
            </Alert>
          )}

          {formError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">
                    {showCurrentPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">
                    {showNewPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
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

            <Button
              type="submit"
              className="w-full"
              disabled={auth.isLoading}
            >
              {auth.isLoading ? "Changing Password..." : "Change Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
