import type { Contact } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhatsAppViewProps {
  contact: Contact;
  onBack: () => void;
  history?: any[];
}

export function WhatsAppView({ contact, onBack, history = [] }: WhatsAppViewProps) {
  const formatDate = (date: number | Date) => {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  // Process history to match display format
  // History items from backend are ChatCompletionMessageParam usually { role, content }
  const messages = history.length > 0 ? history.map((msg, idx) => ({
    id: idx,
    text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    sender: msg.role === 'user' ? 'user' : 'bot',
    timestamp: Date.now() // Timestamps might not be in the message object if it's raw OpenAI format, but ChatHistoryStorage saves with metadata? 
                          // Actually ChatHistoryStorage saves { metadata, messages }. The messages array is just OpenAI params which doesn't have timestamp per message usually.
                          // But wait, the backend `saveChatHistory` saves `messages` array.
                          // If we want timestamps per message, we need to change how we store messages or just use relative order.
                          // For now, we mimic timestamp or use placeholder interaction time if available.
  })) : [
    { id: 1, text: "No conversation history found.", sender: "bot", timestamp: Date.now() }
  ];


  return (
    <div className="flex flex-col h-full bg-[#0b141a] text-[#e9edef]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-white/5">
        <Button 
          variant="ghost" 
          size="icon-sm" 
          onClick={onBack}
          className="text-[#aebac1] hover:bg-white/5 hover:text-[#e9edef]"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <Avatar className="size-10">
          <AvatarFallback className="bg-[#6a7175] text-white">
            {contact.name?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{contact.name}</div>
          <div className="text-xs text-[#8696a0] truncate">
            {contact.last_active ? `Last active ${formatDate(contact.last_active)}` : "Offline"}
          </div>
        </div>
      </div>

      {/* Chat Area with Doodle Background */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-2 relative"
        style={{
          backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "400px",
          backgroundColor: "#0b141a"
        }}
      >
        <div className="absolute inset-0 bg-[#0b141a]/90 pointer-events-none" /> {/* Overlay to darken doodle */}
        
        <div className="relative z-10 space-y-4 max-w-3xl mx-auto">
          {/* Date separator */}
          <div className="flex justify-center my-4">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg shadow-sm">
              Conversation History
            </span>
          </div>

          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex mb-1",
                msg.sender === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div 
                className={cn(
                  "max-w-[80%] md:max-w-[60%] rounded-lg px-3 py-1.5 shadow-sm relative group text-sm leading-relaxed",
                  msg.sender === "user" 
                    ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none" 
                    : "bg-[#202c33] text-[#e9edef] rounded-tl-none"
                )}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}
          
          <div className="flex justify-center my-8 text-xs text-[#8696a0]">
            <span className="flex items-center gap-1 bg-[#182229] px-3 py-1.5 rounded-lg">
              <MessageCircle className="size-3" /> 
              End of history
            </span>
          </div>
        </div>
      </div>

      {/* Input Area (Read Only for now) */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-2 border-t border-white/5">
        <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2 text-[#aebac1] text-sm italic">
          Replies are managed by AI
        </div>
      </div>
    </div>
  );
}
