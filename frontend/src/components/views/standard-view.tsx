import type { Contact } from "@/stores/admin-store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface StandardViewProps {
  contact: Contact;
  onBack: () => void;
  history?: any[];
}

export function StandardView({ contact, onBack, history = [] }: StandardViewProps) {
  const formatDate = (date: number | Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  const messages = history.length > 0 ? history.map((msg, idx) => ({
    id: idx,
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    role: msg.role === 'user' ? 'user' : 'bot'
  })) : [
    { id: 1, content: "No conversation history found.", role: 'bot' }
  ];

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/40">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {contact.name?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{contact.name}</span>
            <Badge variant="secondary" className="text-xs font-normal">Web User</Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {contact.last_active ? `Last active ${formatDate(contact.last_active)}` : "Offline"}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                </div>
             </div>
        ))}
         <div className="flex justify-center text-xs text-muted-foreground pt-4">
            <Clock className="size-3 mr-1" /> End of history
         </div>
      </div>
    </div>
  );
}
