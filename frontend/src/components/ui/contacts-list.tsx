import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useAdminStore, type Contact } from "@/stores/admin-store";
import { Badge } from "./badge";
import { Button } from "./button";
import { MessageCircle, Globe, MessageSquare, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ContactsListProps {
  onViewDetails?: (contact: Contact) => void;
}

export function ContactsList({ onViewDetails }: ContactsListProps) {
  const token = useAuthStore((state) => state.token);
  const { contacts, isLoading, error, fetchContacts, deleteContact } = useAdminStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchContacts(token);
    }
  }, [token]);

  const handleDelete = async (contactId: string) => {
    if (!token) return;
    setDeletingId(contactId);
    setConfirmDeleteId(null); // Close dialog
    try {
      const success = await deleteContact(token, contactId);
      if (success) {
        toast.success("Contact deleted successfully");
      } else {
        toast.error("Failed to delete contact");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageCircle className="size-3" />;
      case "web":
        return <Globe className="size-3" />;
      default:
        return <Globe className="size-3" />;
    }
  };

  const getChannelBadgeVariant = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return "default" as const;
      case "web":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const formatDate = (timestampMs: number) => {
    if (!timestampMs) return "-";
    return new Date(timestampMs).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading contacts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">No contacts found</div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name / ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Channel
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Last Active
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {contact.name?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {contact.name || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contact.id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={getChannelBadgeVariant(contact.channel)}
                    className="gap-1 capitalize"
                  >
                    {getChannelIcon(contact.channel)}
                    {contact.channel}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    {formatDate(contact.last_active)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {onViewDetails && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onViewDetails(contact)}
                        title="View Conversation"
                      >
                        <MessageSquare className="size-4" />
                      </Button>
                    )}
                    
                    <Dialog open={confirmDeleteId === contact.id} onOpenChange={(open) => setConfirmDeleteId(open ? contact.id : null)}>
                      <DialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete Contact"
                            disabled={deletingId === contact.id}
                        >
                            {deletingId === contact.id ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Trash2 className="size-4" />
                            )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Contact?</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete <strong>{contact.name}</strong>? 
                            This action cannot be undone and will delete the contact and their conversation history.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                          <DialogClose asChild>
                             <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleDelete(contact.id)}
                          >
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
    </div>
  );
}
