import { createContext, useContext } from "react";

export const WebSocketContext = createContext(null);

export  function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("WebSocketContext not found!");
  return ctx;
}