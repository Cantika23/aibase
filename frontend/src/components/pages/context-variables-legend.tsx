import {
  Copy,
  User,
  Wrench,
  Calendar,
  Info
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VariableGroup {
  name: string;
  icon: React.ReactNode;
  variables: {
    label: string;
    value: string;
    description: string;
  }[];
}

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    name: "User & Client",
    icon: <User className="h-4 w-4" />,
    variables: [
      { label: "User Name", value: "{{user.name}}", description: "The name of the user chatting" },
      { label: "User Phone", value: "{{user.phone}}", description: "Phone number (WhatsApp ID)" },
      { label: "User Language", value: "{{user.language}}", description: "Detected language code (e.g. id, en)" },
    ]
  },
  {
    name: "System Context",
    icon: <Calendar className="h-4 w-4" />,
    variables: [
      { label: "Current Date", value: "{{date}}", description: "Current date (YYYY-MM-DD)" },
      { label: "Current Time", value: "{{time}}", description: "Current time (HH:mm)" },
      { label: "Assistant Name", value: "{{assistant.name}}", description: "Name of this AI assistant" },
    ]
  },
  {
    name: "Tools & Logic",
    icon: <Wrench className="h-4 w-4" />,
    variables: [
      { label: "Tool Context", value: "{{toolcontext}}", description: "Output from tool executions (CRITICAL)" },
      { label: "Memory", value: "{{memory}}", description: "Retrieved long-term memory" },
    ]
  },
];

interface ContextVariablesLegendProps {
  className?: string;
  onInsert?: (variable: string) => void;
}

export function ContextVariablesLegend({ className, onInsert }: ContextVariablesLegendProps) {
  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard", {
      description: `${label} (${value}) ready to paste.`
    });
    
    // Optional: directly insert if handler provided
    if (onInsert) {
      onInsert(value);
    }
  };

  return (
    <div className={cn("flex flex-col h-full border-l bg-muted/10 w-80", className)}>
      <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0">
        <Info className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium text-sm">Variable Legend</h3>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {VARIABLE_GROUPS.map((group) => (
            <div key={group.name} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group.icon}
                <span>{group.name}</span>
              </div>
              
              <div className="grid gap-2">
                {group.variables.map((variable) => (
                  <button
                    key={variable.value}
                    onClick={() => handleCopy(variable.value, variable.label)}
                    className="flex items-start gap-3 p-3 w-full text-left rounded-lg border bg-card/60 hover:bg-accent/50 hover:border-primary/20 transition-all group/item"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-primary/90 bg-primary/5 px-1.5 py-0.5 rounded">
                          {variable.value}
                        </span>
                        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {variable.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t bg-muted/20 text-xs text-muted-foreground text-center">
        Click to copy variable to clipboard
      </div>
    </div>
  );
}
