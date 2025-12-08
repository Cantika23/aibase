import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { AppRouter } from "./components/app-router";

// Create WebSocket URL dynamically to work with Vite proxy
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/api/ws`;

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AppRouter wsUrl={wsUrl} />
  </BrowserRouter>
);
