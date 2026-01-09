/**
 * @file Counter App Example - Demonstrates unified app with structured tool data
 *
 * This example shows how to build a cross-platform app that works on both
 * OpenAI ChatGPT and MCP Apps platforms.
 *
 * Flow:
 * 1. Initialize unified app
 * 2. If initialProps available (OpenAI), use it; otherwise call get-counter tool
 * 3. Show counter, on click: update UI, widget state, and call set-counter tool
 * 4. Handle tool result - show error if status is false
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useUnifiedApp } from "mcp-ui-ext-apps-openai/react";

const APP_INFO = { name: "Counter App", version: "1.0.0" };

// Structured data format returned by tools
interface CounterData {
  status: boolean;
  value?: number;
  error?: string;
}

function CounterApp() {
  const {
    app,
    isConnected,
    platform,
    hostContext,
    initialProps,
    widgetState,
    setWidgetState,
  } = useUnifiedApp({
    appInfo: APP_INFO,
    capabilities: {},
    onError: (e) => console.error("[CounterApp]", e),
  });

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get counter value from widget state
  const counter = (widgetState as { value?: number } | null)?.value ?? 0;

  /**
   * Fetch counter from server using get-counter tool
   */
  const fetchCounter = useCallback(async () => {
    if (!app) return;

    setError(null);

    try {
      const result = await app.callServerTool({ name: "get-counter", arguments: {} });
      const data = (result as CallToolResult).structuredContent as unknown as CounterData;

      if (data.status && data.value !== undefined) {
        setWidgetState({ value: data.value });
      } else {
        setError(data.error || "Failed to get counter");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get counter");
    }
  }, [app, setWidgetState]);

  /**
   * Initialize counter from initialProps or fetch from server
   */
  useEffect(() => {
    if (!app || !isConnected) return;

    // Check if we have initial props (OpenAI case with toolOutput as CallToolResult)
    if (initialProps !== undefined) {
      const data = (initialProps as CallToolResult).structuredContent as unknown as CounterData | undefined;
      if (data?.status && data.value !== undefined) {
        setWidgetState({ value: data.value });
        return;
      }
    }

    // No initial props or invalid format, fetch from server
    fetchCounter();
  }, [app, isConnected, initialProps, setWidgetState, fetchCounter]);

  /**
   * Increment counter: update UI, widget state, and persist to server
   */
  const handleIncrement = useCallback(async () => {
    if (!app || isSaving) return;

    const newValue = counter + 1;

    // Optimistic update
    setWidgetState({ value: newValue });
    setError(null);
    setIsSaving(true);

    try {
      const result = await app.callServerTool({
        name: "set-counter",
        arguments: { value: newValue }
      });
      const data = (result as CallToolResult).structuredContent as unknown as CounterData;

      if (!data.status) {
        // Revert on error
        setWidgetState({ value: counter });
        setError(data.error || "Failed to save counter");
      }
    } catch (e) {
      // Revert on error
      setWidgetState({ value: counter });
      setError(e instanceof Error ? e.message : "Failed to save counter");
    } finally {
      setIsSaving(false);
    }
  }, [app, counter, isSaving, setWidgetState]);

  /**
   * Decrement counter
   */
  const handleDecrement = useCallback(async () => {
    if (!app || isSaving) return;

    const newValue = Math.max(0, counter - 1);

    // Optimistic update
    setWidgetState({ value: newValue });
    setError(null);
    setIsSaving(true);

    try {
      const result = await app.callServerTool({
        name: "set-counter",
        arguments: { value: newValue }
      });
      const data = (result as CallToolResult).structuredContent as unknown as CounterData;

      if (!data.status) {
        // Revert on error
        setWidgetState({ value: counter });
        setError(data.error || "Failed to save counter");
      }
    } catch (e) {
      // Revert on error
      setWidgetState({ value: counter });
      setError(e instanceof Error ? e.message : "Failed to save counter");
    } finally {
      setIsSaving(false);
    }
  }, [app, counter, isSaving, setWidgetState]);

  return (
    <main style={{ padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ color: "#666", fontSize: "0.875rem" }}>
        Platform: <strong>{platform}</strong> | Theme: <strong>{hostContext?.theme ?? "unknown"}</strong>
      </p>

      {error && (
        <div style={{ color: "red", marginBottom: "1rem", padding: "0.5rem", background: "#fee" }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "0.5rem" }}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>
          Counter: <code>{counter}</code>
        </p>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={handleDecrement}
            disabled={isSaving || counter === 0}
            style={{ padding: "0.5rem 1rem", fontSize: "1.5rem" }}
          >
            {isSaving ? "..." : "−"}
          </button>
          <button
            onClick={handleIncrement}
            disabled={isSaving}
            style={{ padding: "0.5rem 1rem", fontSize: "1.5rem" }}
          >
            {isSaving ? "..." : "+"}
          </button>
        </div>
      </div>

      <div>
        <button onClick={fetchCounter} disabled={isSaving}>
          Refresh from Server
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CounterApp />
  </StrictMode>,
);
