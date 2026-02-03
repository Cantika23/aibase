import type { Contact } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  MoreVertical, 
  Search,
  CheckCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";

interface WhatsAppViewProps {
  contact: Contact;
  onBack: () => void;
  // allow history to be loose type as it comes from complex backend objects
  history?: any[]; 
}

interface Message {
  id: string | number;
  text: string;
  sender: "user" | "bot";
  timestamp: string; // formatted time string
  status?: "sent" | "delivered" | "read";
  isFirstInGroup?: boolean;
}

export function WhatsAppView({ contact, onBack, history = [] }: WhatsAppViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [formattedMessages, setFormattedMessages] = useState<Message[]>([]);

  // Format Helpers
  const formatTime = (dateInput: number | Date | undefined) => {
    if (!dateInput) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true
    }).format(new Date(dateInput));
  };
  
  const formatLastActive = (date: number | Date) => {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  // Effect to process history
  useEffect(() => {
    if (!history?.length) {
      setFormattedMessages([{
        id: "welcome",
        text: "This chat is managed by AI. Messages are processed automatically.",
        sender: "bot",
        timestamp: formatTime(Date.now()),
        status: "read",
        isFirstInGroup: true
      }]);
      return;
    }

    const processed: Message[] = history
      .filter((msg) => msg.role !== 'system')
      .map((msg, idx) => {
        const isUser = msg.role === 'user';
        return {
          id: idx,
          text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          sender: isUser ? 'user' : 'bot',
          // Use current time as fallback since history objects might lack timestamps
          timestamp: formatTime(Date.now()), 
          status: "read", // Assume read for history
          isFirstInGroup: true // simplified for now
        };
      });

    // Calculate grouping (tail logic)
    const grouped = processed.map((msg, index, arr) => {
      const prev = arr[index - 1];
      const isFirst = !prev || prev.sender !== msg.sender;
      return { ...msg, isFirstInGroup: isFirst };
    });

    setFormattedMessages(grouped);
  }, [history]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [formattedMessages]);

  return (
    <div className="flex flex-col h-full bg-[#efe7dd] text-[#111b21] font-sans overflow-hidden">
      {/* 
        HEADER
        WhatsApp Light Mode Header: #f0f2f5
      */}
      <div className="flex items-center justify-between px-2 py-2 bg-[#f0f2f5] border-b border-[#d1d7db] z-20 shrink-0 select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="text-[#54656f] hover:bg-[#d1d7db] rounded-full w-10 h-10 shrink-0"
          >
            <ArrowLeft className="w-5 h-5 lg:w-6 lg:h-6" />
          </Button>

          <div className="flex items-center gap-3 cursor-pointer hover:bg-[#d1d7db] p-1 pr-4 rounded-lg transition-colors overflow-hidden">
            <Avatar className="w-9 h-9 lg:w-10 lg:h-10 border border-[#d1d7db]">
              <AvatarImage src={`https://ui-avatars.com/api/?name=${contact.name}&background=random`} />
              <AvatarFallback className="bg-[#dfe3e5] text-[#111b21] font-medium">
                {contact.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col justify-center min-w-0">
              <span className="font-normal text-[16px] leading-tight text-[#111b21] truncate">
                {contact.name}
              </span>
              <span className="text-[13px] leading-tight text-[#667781] truncate">
                {contact.last_active ? `last seen ${formatLastActive(contact.last_active)}` : "click here for contact info"}
              </span>
            </div>
          </div>
        </div>


        <div className="flex items-center gap-1 sm:gap-2 pr-1 text-[#54656f]">
          <Button variant="ghost" size="icon" className="w-10 h-10 hover:bg-[#d1d7db] rounded-full">
            <Search className="w-5 h-5 stroke-[1.5]" />
          </Button>
          <Button variant="ghost" size="icon" className="w-10 h-10 hover:bg-[#d1d7db] rounded-full">
            <MoreVertical className="w-5 h-5 stroke-[1.5]" />
          </Button>
        </div>
      </div>

      {/* 
        CHAT AREA 
        Base: #efe7dd
        Doodle: Transparent overlay
      */}
      <div 
        className="relative flex-1 bg-[#efe7dd] overflow-hidden" 
      >
        {/* Doodle Background */}
        <div 
          className="absolute inset-0 opacity-[0.9] pointer-events-none normal-blend"
          style={{
            backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
            backgroundSize: "412px" 
          }}
        />

        {/* Messages Container */}
        <div 
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto px-[5%] py-4 space-y-1 custom-scrollbar"
        >
          {/* Encryption Notice */}
          <div className="flex justify-center mb-6 mt-2">
            <div className="bg-[#ffeecd] text-[#54656f] text-[12.5px] px-3 py-1.5 rounded-lg text-center max-w-[90%] shadow-sm select-none">
              <span className="flex items-center justify-center gap-1.5">
               Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
              </span>
            </div>
          </div>

          {!formattedMessages.length && (
             <div className="flex justify-center mt-12 opacity-50">
                <span className="text-[#54656f] text-sm">No messages yet</span>
             </div>
          )}

          {formattedMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Spacer for bottom input */}
           <div className="h-4" />
        </div>
      </div>

      {/* 
        INPUT AREA (Read Only)
        Bg: #f0f2f5
      */}
      <div className="min-h-[62px] bg-[#f0f2f5] px-4 py-2 flex items-center justify-center shrink-0 z-20 border-t border-[#d1d7db]">
           <div className="bg-[#ffffff] py-1.5 px-4 rounded-lg shadow-sm w-full max-w-sm border border-gray-100 flex justify-center">
             <span className="text-[#54656f] text-[12.5px] font-normal tracking-wide flex items-center gap-2 select-none">
               <span className="w-1 h-1 rounded-full bg-[#54656f]/60 block" />
               Replies are managed by AI
               <span className="w-1 h-1 rounded-full bg-[#54656f]/60 block" />
             </span>
           </div>
      </div>
    
      </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === "user";
  
  return (
    <div 
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        message.isFirstInGroup ? "mt-2" : "mt-0.5" 
      )}
    >
      <div 
        className={cn(
          "relative max-w-[85%] sm:max-w-[65%] rounded-lg px-2 py-1 shadow-sm text-[14.2px] leading-[19px]",
          isUser 
            ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none" 
            : "bg-[#ffffff] text-[#111b21] rounded-tl-none"
        )}
        style={{
           // Add subtle tail using border radius trick + pseudo element would be ideal, 
           // but generic rounded corners work 90% well for "web" look.
           // Real whatsapp web uses SVGs for tails.
        }}
      > 
        {/* Tail SVG */}
        {message.isFirstInGroup && isUser && (
          <span className="absolute -right-2 top-0 text-[#d9fdd3]">
            <svg viewBox="0 0 8 13" height="13" width="8" preserveAspectRatio="none" className="fill-current block">
               <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"/>
            </svg>
          </span>
        )}
        {message.isFirstInGroup && !isUser && (
           <span className="absolute -left-2 top-0 text-[#ffffff]">
              <svg viewBox="0 0 8 13" height="13" width="8" preserveAspectRatio="none" className="fill-current block scale-x-[-1]">
                 <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"/>
              </svg>
           </span>
        )}

        <div className="px-1 pt-1 pb-4 min-w-[80px]">
           <span className="whitespace-pre-wrap break-words">{message.text}</span>
        </div>

        {/* Metadata: Time + Status */}
        <div className="absolute right-1.5 bottom-1 flex items-center gap-1 select-none">
          <span className="text-[11px] text-[#667781] tabular-nums leading-none">
            {message.timestamp}
          </span>
          {isUser && (
            <span className={cn(
              "text-[15px]",
              message.status === 'read' ? "text-[#53bdeb]" : "text-[#667781]"
            )}>
              <CheckCheck className={cn("w-4 h-4", message.status === 'read' ? "stroke-[#53bdeb]" : "stroke-[#667781]")} strokeWidth={1.5} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
