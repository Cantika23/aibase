import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ShadcnChatInterface } from "./components/shadcn-chat-interface";

// Create WebSocket URL that points to the same domain with /api/ws path

const wsUrl = `ws://localhost:5040/api/ws`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ShadcnChatInterface wsUrl={wsUrl} />
  </StrictMode>
);
