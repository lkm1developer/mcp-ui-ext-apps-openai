# mcp-ui-ext-apps-openai

[![npm version](https://badge.fury.io/js/mcp-ui-ext-apps-openai.svg)](https://www.npmjs.com/package/mcp-ui-ext-apps-openai)
[![GitHub](https://img.shields.io/github/license/lkm1developer/mcp-ui-ext-apps-openai)](https://github.com/lkm1developer/mcp-ui-ext-apps-openai/blob/main/LICENSE)

Unified utility for building apps that work on both **OpenAI ChatGPT** and **MCP Apps** platforms.

**Author:** [lkm1developer](https://github.com/lkm1developer)

## Installation

```bash
npm install mcp-ui-ext-apps-openai
```

## Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install @modelcontextprotocol/ext-apps react
```

## Usage

### React Hook (Recommended)

```tsx
import { useUnifiedApp } from "mcp-ui-ext-apps-openai/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Define your structured data type
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
    appInfo: { name: "Counter App", version: "1.0.0" },
    capabilities: {},
    onError: (e) => console.error("[CounterApp]", e),
  });

  // Get counter value from widget state
  const counter = (widgetState as { value?: number } | null)?.value ?? 0;

  // Fetch counter from server
  const fetchCounter = async () => {
    if (!app) return;

    const result = await app.callServerTool({ name: "get-counter", arguments: {} });
    const data = (result as CallToolResult).structuredContent as unknown as CounterData;

    if (data.status && data.value !== undefined) {
      setWidgetState({ value: data.value });
    }
  };

  // Initialize from initialProps (OpenAI) or fetch from server (MCP)
  useEffect(() => {
    if (!app || !isConnected) return;

    if (initialProps !== undefined) {
      const data = (initialProps as CallToolResult).structuredContent as unknown as CounterData;
      if (data?.status && data.value !== undefined) {
        setWidgetState({ value: data.value });
        return;
      }
    }

    fetchCounter();
  }, [app, isConnected, initialProps]);

  // Increment counter
  const handleIncrement = async () => {
    if (!app) return;

    const newValue = counter + 1;
    setWidgetState({ value: newValue }); // Optimistic update

    const result = await app.callServerTool({
      name: "set-counter",
      arguments: { value: newValue }
    });
    const data = (result as CallToolResult).structuredContent as unknown as CounterData;

    if (!data.status) {
      setWidgetState({ value: counter }); // Revert on error
    }
  };

  return (
    <div>
      <p>Platform: {platform}</p>
      <p>Theme: {hostContext?.theme}</p>
      <p>Counter: {counter}</p>
      <button onClick={handleIncrement}>+</button>
      <button onClick={fetchCounter}>Refresh</button>
    </div>
  );
}
```

### Core Utilities (No React)

```ts
import { detectPlatform, isOpenAI, isMCP, createUnifiedApp } from "mcp-ui-ext-apps-openai";

// Check platform
const platform = detectPlatform(); // "openai" | "mcp" | "unknown"

if (isOpenAI()) {
  console.log("Running on OpenAI ChatGPT");
} else if (isMCP()) {
  console.log("Running on MCP Apps");
}

// Create unified app (for OpenAI only - use React hook for MCP)
const { app, isConnected, error } = createUnifiedApp({
  appInfo: { name: "My App", version: "1.0.0" },
  onError: console.error,
});

if (app && isConnected) {
  const result = await app.callServerTool({ name: "my-tool", arguments: {} });
}
```

## API Reference

### `useUnifiedApp(options)`

React hook that provides a unified app interface for both platforms.

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `appInfo` | `{ name: string; version: string }` | App information |
| `capabilities` | `McpUiAppCapabilities` | Optional capabilities |
| `onToolInput` | `(input: unknown) => void` | Called when tool input is received |
| `onToolResult` | `(result: UnifiedToolResult) => void` | Called when tool result is received |
| `onHostContextChanged` | `(context: UnifiedHostContext) => void` | Called when host context changes |
| `onTeardown` | `() => void` | Called when app is being torn down |
| `onError` | `(error: Error) => void` | Called on errors (also logs to console) |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `app` | `UnifiedApp \| null` | The unified app instance |
| `isConnected` | `boolean` | Whether connected to host |
| `error` | `Error \| null` | Any connection error |
| `platform` | `"openai" \| "mcp" \| "unknown"` | Detected platform |
| `hostContext` | `UnifiedHostContext` | Current host context (theme, locale, etc.) |
| `initialProps` | `unknown` | Initial props from toolOutput (OpenAI only) |
| `widgetProps` | `Record<string, unknown>` | Widget props (OpenAI only) |
| `widgetState` | `unknown` | Widget state (works on both platforms) |
| `setWidgetState` | `(state: T) => void` | Set widget state |
| `updateWidgetState` | `(state: Partial<T>) => void` | Partially update widget state |

### `UnifiedApp` Interface

| Method | Description |
|--------|-------------|
| `callServerTool({ name, arguments })` | Call a server tool |
| `sendMessage(message, options?)` | Send a message to the host |
| `sendLog({ level, data })` | Send a log message |
| `openLink({ url })` | Open an external link |
| `getHostContext()` | Get current host context |
| `setWidgetState(state)` | Set widget state (OpenAI only) |
| `updateWidgetState(state)` | Update widget state partially (OpenAI only) |
| `requestDisplayMode(mode)` | Request display mode (OpenAI only) |
| `requestClose()` | Request to close widget (OpenAI only) |
| `uploadFile(file)` | Upload a file (OpenAI only) |
| `getFileDownloadUrl({ fileId })` | Get file download URL (OpenAI only) |

### Platform-Specific Behavior

| Feature | OpenAI | MCP |
|---------|--------|-----|
| `widgetState` | Syncs to OpenAI + React state | React state only |
| `initialProps` | From `toolOutput` | `undefined` |
| `widgetProps` | From `widget.props` | `{}` |
| `uploadFile` | Works | Throws error |
| `requestDisplayMode` | Works | No-op |
| `callCompletion` | Works | Throws error |

## Structured Tool Data

Tools should return structured data in `structuredContent`:

```ts
// Server tool response format
{
  status: true,
  value: 42,
  // or on error:
  // status: false,
  // error: "Something went wrong"
}

// Access in client
const result = await app.callServerTool({ name: "get-counter", arguments: {} });
const data = (result as CallToolResult).structuredContent as unknown as CounterData;

if (data.status) {
  console.log("Value:", data.value);
} else {
  console.error("Error:", data.error);
}
```

## License

MIT
