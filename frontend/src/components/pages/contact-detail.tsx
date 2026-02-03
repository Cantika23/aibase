import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useAdminStore, type Contact } from "@/stores/admin-store";
import { WhatsAppView } from "@/components/views/whatsapp-view";
import { StandardView } from "@/components/views/standard-view";
import { Loader2 } from "lucide-react";

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const { fetchContact } = useAdminStore();
  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContact() {
       if (!token || !id) return;
       setIsLoading(true);
       try {
         const data = await fetchContact(token, id);
         if (data) {
           setContact(data);
         } else {
           setError("Contact not found");
         }
       } catch (err) {
         setError("Failed to load contact");
       } finally {
         setIsLoading(false);
       }
    }
    loadContact();
  }, [token, id, fetchContact]);

  const handleBack = () => {
    navigate("/admin/users"); // Or appropriate parent route
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4">
        <div className="text-destructive font-medium">{error || "Contact not found"}</div>
        <button onClick={handleBack} className="text-sm underline">Go Back</button>
      </div>
    );
  }

  // Adaptive UI Rendering
  if (contact.channel === 'whatsapp') {
    return <WhatsAppView contact={contact} onBack={handleBack} history={(contact as any).history} />;
  }

  return <StandardView contact={contact} onBack={handleBack} history={(contact as any).history} />;
}
