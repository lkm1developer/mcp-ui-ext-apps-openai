/**
 * @file Unified App Utility - Works with both OpenAI ChatGPT Apps and MCP Apps
 *
 * This utility provides a unified interface that abstracts away the differences
 * between OpenAI's window.openai API and MCP Apps SDK.
 */

import type { App, McpUiAppCapabilities } from "@modelcontextprotocol/ext-apps";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type Platform = "openai" | "mcp" | "unknown";

export interface UnifiedToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface UnifiedMessage {
  role: "user" | "assistant";
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

export interface UnifiedHostContext {
  theme?: "light" | "dark";
  displayMode?: "inline" | "pip" | "fullscreen";
  locale?: string;
  safeAreaInsets?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  maxWidth?: number;
  maxHeight?: number;
}

export interface UnifiedAppOptions {
  appInfo: { name: string; version: string };
  capabilities?: McpUiAppCapabilities;
  onToolInput?: (input: unknown) => void | Promise<void>;
  onToolResult?: (result: UnifiedToolResult) => void | Promise<void>;
  onHostContextChanged?: (context: UnifiedHostContext) => void;
  onTeardown?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

export interface UnifiedApp {
  /** The underlying platform */
  platform: Platform;

  /** Call a server tool by name with arguments */
  callServerTool: (params: { name: string; arguments: Record<string, unknown> }) => Promise<UnifiedToolResult>;

  /** Send a message to the host/conversation */
  sendMessage: (message: UnifiedMessage, options?: { signal?: AbortSignal }) => Promise<{ isError: boolean }>;

  /** Send a log message to the host */
  sendLog: (params: { level: "info" | "warning" | "error" | "debug"; data: string }) => Promise<void>;

  /** Open an external link */
  openLink: (params: { url: string }) => Promise<{ isError: boolean }>;

  /** Get the current host context */
  getHostContext: () => UnifiedHostContext;

  /** Get tool input (initial arguments passed to the tool) */
  getToolInput: () => Record<string, unknown>;

  /** Get tool output (result from server) */
  getToolOutput: () => unknown;

  /** Get tool response metadata (OpenAI only, returns {} on MCP) */
  getToolResponseMetadata: () => Record<string, unknown>;

  /** Get widget state (OpenAI only, returns null on MCP) */
  getWidgetState: <T = unknown>() => T | null;

  /** Get widget props (OpenAI only, returns {} on MCP) */
  getWidgetProps: <T = Record<string, unknown>>() => T;

  /** Set widget state - persists across renders (OpenAI only, no-op on MCP) */
  setWidgetState: <T = unknown>(state: T) => void;

  /** Update widget state - partial update (OpenAI only, no-op on MCP) */
  updateWidgetState: <T = unknown>(state: Partial<T>) => void;

  /** Request a specific display mode (OpenAI only, no-op on MCP) */
  requestDisplayMode: (mode: "inline" | "pip" | "fullscreen") => Promise<void>;

  /** Request to close the widget (OpenAI only, no-op on MCP) */
  requestClose: () => void;

  /** Notify intrinsic height for dynamic sizing (OpenAI only, no-op on MCP) */
  notifyIntrinsicHeight: (height: number) => void;

  /** Upload a file (OpenAI only, throws on MCP) */
  uploadFile: (file: File) => Promise<{ fileId: string }>;

  /** Get file download URL (OpenAI only, throws on MCP) */
  getFileDownloadUrl: (params: { fileId: string }) => Promise<string>;

  /** Set URL for "Open in App" button (OpenAI only, no-op on MCP) */
  setOpenInAppUrl: (params: { href: string }) => void;

  /** Share content (OpenAI only, throws on MCP) */
  share: (params: unknown) => Promise<void>;

  /** Call AI completion (OpenAI only, throws on MCP) */
  callCompletion: (params: unknown) => Promise<unknown>;

  /** Stream AI completion (OpenAI only, throws on MCP) */
  streamCompletion: (params: unknown) => AsyncIterable<unknown>;

  /** The raw underlying app instance */
  _raw: App | OpenAIGlobal | null;
}

// OpenAI window.openai type definition based on documentation
export interface OpenAIGlobal {
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  sendFollowUpMessage: (params: { prompt: string }) => Promise<void>;
  openExternal: (params: { href: string }) => Promise<void>;
  setOpenInAppUrl: (params: { href: string }) => void;
  requestDisplayMode: (mode: string) => Promise<void>;
  requestModal: (params: unknown) => Promise<void>;
  requestClose: () => void;
  notifyIntrinsicHeight: (height: number) => void;
  uploadFile: (file: File) => Promise<{ fileId: string }>;
  getFileDownloadUrl: (params: { fileId: string }) => Promise<string>;
  getFileMetadata: (params: { fileId: string }) => Promise<unknown>;
  setWidgetState: (state: unknown) => void;
  updateWidgetState: (state: unknown) => void;
  share: (params: unknown) => Promise<void>;
  streamCompletion: (params: unknown) => AsyncIterable<unknown>;
  callCompletion: (params: unknown) => Promise<unknown>;

  // Properties
  toolInput: Record<string, unknown>;
  toolOutput: unknown;
  toolResponseMetadata: Record<string, unknown>;
  widgetState: unknown;
  theme: "light" | "dark";
  displayMode: "inline" | "pip" | "fullscreen";
  locale: string;
  maxWidth?: number;
  maxHeight?: number;
  safeArea: { insets: { top: number; right: number; bottom: number; left: number } };
  userAgent: { device: unknown; capabilities: unknown };
  view: { params: unknown; mode: string };
  widget: { state: unknown; props: unknown; setState: (state: unknown) => void };
  subjectId: string;
}

/** Widget props from OpenAI (passed to widget via widget.props) */
export interface OpenAIWidgetProps {
  [key: string]: unknown;
}

declare global {
  interface Window {
    openai?: OpenAIGlobal;
  }
}

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect which platform the app is running on
 */
export function detectPlatform(): Platform {
  if (typeof window !== "undefined" && window.openai) {
    return "openai";
  }
  // MCP apps are detected by the useApp hook connecting successfully
  // For now, return "unknown" and let the hook determine
  return "unknown";
}

/**
 * Check if running in OpenAI ChatGPT environment
 */
export function isOpenAI(): boolean {
  return detectPlatform() === "openai";
}

/**
 * Check if running in MCP Apps environment
 */
export function isMCP(): boolean {
  return detectPlatform() === "mcp" || detectPlatform() === "unknown";
}

// ============================================================================
// OpenAI Adapter
// ============================================================================

/**
 * Create a UnifiedApp from OpenAI's window.openai
 */
export function createOpenAIAdapter(options: UnifiedAppOptions): UnifiedApp {
  const openai = window.openai!;

  // Set up event listeners for OpenAI
  const handleGlobalsChange = (_event: Event) => {
    if (options.onHostContextChanged) {
      options.onHostContextChanged({
        theme: openai.theme,
        displayMode: openai.displayMode as UnifiedHostContext["displayMode"],
        locale: openai.locale,
        safeAreaInsets: openai.safeArea?.insets,
        maxWidth: openai.maxWidth,
        maxHeight: openai.maxHeight,
      });
    }
  };

  window.addEventListener("openai:set_globals", handleGlobalsChange);

  // Initial context callback
  if (options.onHostContextChanged) {
    options.onHostContextChanged({
      theme: openai.theme,
      displayMode: openai.displayMode as UnifiedHostContext["displayMode"],
      locale: openai.locale,
      safeAreaInsets: openai.safeArea?.insets,
      maxWidth: openai.maxWidth,
      maxHeight: openai.maxHeight,
    });
  }

  // If there's initial tool output, notify
  if (options.onToolResult && openai.toolOutput) {
    const result = convertOpenAIToolOutput(openai.toolOutput);
    options.onToolResult(result);
  }

  if (options.onToolInput && openai.toolInput) {
    options.onToolInput(openai.toolInput);
  }

  return {
    platform: "openai",

    callServerTool: async ({ name, arguments: args }) => {
      try {
        const result = await openai.callTool(name, args);
        return convertOpenAIToolOutput(result);
      } catch (error) {
        if (options.onError) {
          options.onError(error as Error);
        }
        throw error;
      }
    },

    sendMessage: async (message, _opts) => {
      try {
        // OpenAI uses sendFollowUpMessage for user messages
        const textContent = message.content.find(c => c.type === "text");
        if (textContent?.text) {
          await openai.sendFollowUpMessage({ prompt: textContent.text });
        }
        return { isError: false };
      } catch (error) {
        if (options.onError) {
          options.onError(error as Error);
        }
        return { isError: true };
      }
    },

    sendLog: async ({ level, data }) => {
      // OpenAI doesn't have a direct log API, use console as fallback
      // Map 'warning' to 'warn' for console compatibility
      const consoleLevel = level === "warning" ? "warn" : level;
      console[consoleLevel](`[${options.appInfo.name}]`, data);
    },

    openLink: async ({ url }) => {
      try {
        await openai.openExternal({ href: url });
        return { isError: false };
      } catch (error) {
        if (options.onError) {
          options.onError(error as Error);
        }
        return { isError: true };
      }
    },

    getHostContext: () => ({
      theme: openai.theme,
      displayMode: openai.displayMode as UnifiedHostContext["displayMode"],
      locale: openai.locale,
      safeAreaInsets: openai.safeArea?.insets,
      maxWidth: openai.maxWidth,
      maxHeight: openai.maxHeight,
    }),

    getToolInput: () => openai.toolInput || {},

    getToolOutput: () => openai.toolOutput,

    getToolResponseMetadata: () => openai.toolResponseMetadata || {},

    getWidgetState: <T = unknown>() => openai.widgetState as T | null,

    getWidgetProps: <T = Record<string, unknown>>() => (openai.widget?.props || {}) as T,

    setWidgetState: <T = unknown>(state: T) => {
      openai.setWidgetState(state);
    },

    updateWidgetState: <T = unknown>(state: Partial<T>) => {
      openai.updateWidgetState(state);
    },

    requestDisplayMode: async (mode) => {
      await openai.requestDisplayMode(mode);
    },

    requestClose: () => {
      openai.requestClose();
    },

    notifyIntrinsicHeight: (height) => {
      openai.notifyIntrinsicHeight(height);
    },

    uploadFile: async (file) => {
      return await openai.uploadFile(file);
    },

    getFileDownloadUrl: async ({ fileId }) => {
      return await openai.getFileDownloadUrl({ fileId });
    },

    setOpenInAppUrl: ({ href }) => {
      openai.setOpenInAppUrl({ href });
    },

    share: async (params) => {
      await openai.share(params);
    },

    callCompletion: async (params) => {
      return await openai.callCompletion(params);
    },

    streamCompletion: (params) => {
      return openai.streamCompletion(params);
    },

    _raw: openai,
  };
}

/**
 * Convert OpenAI tool output to unified format
 */
function convertOpenAIToolOutput(output: unknown): UnifiedToolResult {
  // OpenAI tool output can be various formats
  if (typeof output === "string") {
    return {
      content: [{ type: "text", text: output }],
    };
  }

  if (output && typeof output === "object") {
    // Check if it's already in MCP-like format
    if ("content" in output && Array.isArray((output as { content: unknown }).content)) {
      return output as UnifiedToolResult;
    }

    // Check for text property
    if ("text" in output) {
      return {
        content: [{ type: "text", text: String((output as { text: unknown }).text) }],
      };
    }

    // Serialize object as JSON text
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }

  return {
    content: [{ type: "text", text: String(output) }],
  };
}

// ============================================================================
// MCP Adapter
// ============================================================================

/**
 * Create a UnifiedApp from MCP App instance
 */
export function createMCPAdapter(app: App, _options: UnifiedAppOptions): UnifiedApp {
  return {
    platform: "mcp",

    callServerTool: async ({ name, arguments: args }) => {
      const result = await app.callServerTool({ name, arguments: args });
      return result as UnifiedToolResult;
    },

    sendMessage: async (message, opts) => {
      const result = await app.sendMessage(message as Parameters<typeof app.sendMessage>[0], opts);
      return { isError: result.isError ?? false };
    },

    sendLog: async ({ level, data }) => {
      await app.sendLog({ level, data });
    },

    openLink: async ({ url }) => {
      const result = await app.openLink({ url });
      return { isError: result.isError ?? false };
    },

    getHostContext: () => {
      const ctx = app.getHostContext();
      return {
        theme: ctx?.theme as UnifiedHostContext["theme"],
        displayMode: ctx?.displayMode as UnifiedHostContext["displayMode"],
        locale: ctx?.locale,
        safeAreaInsets: ctx?.safeAreaInsets,
      };
    },

    getToolInput: () => ({}), // MCP handles this via ontoolinput callback

    getToolOutput: () => null, // MCP handles this via ontoolresult callback

    // OpenAI-specific methods - no-op or stub implementations for MCP
    getToolResponseMetadata: () => ({}),

    getWidgetState: <T = unknown>() => null as T | null,

    getWidgetProps: <T = Record<string, unknown>>() => ({} as T),

    setWidgetState: <T = unknown>(_state: T) => {
      // No-op on MCP
    },

    updateWidgetState: <T = unknown>(_state: Partial<T>) => {
      // No-op on MCP
    },

    requestDisplayMode: async (_mode) => {
      // No-op on MCP
    },

    requestClose: () => {
      // No-op on MCP
    },

    notifyIntrinsicHeight: (_height) => {
      // No-op on MCP
    },

    uploadFile: async (_file) => {
      throw new Error("uploadFile is not supported on MCP platform");
    },

    getFileDownloadUrl: async (_params) => {
      throw new Error("getFileDownloadUrl is not supported on MCP platform");
    },

    setOpenInAppUrl: (_params) => {
      // No-op on MCP
    },

    share: async (_params) => {
      throw new Error("share is not supported on MCP platform");
    },

    callCompletion: async (_params) => {
      throw new Error("callCompletion is not supported on MCP platform");
    },

    streamCompletion: (_params) => {
      throw new Error("streamCompletion is not supported on MCP platform");
    },

    _raw: app,
  };
}

// ============================================================================
// Unified Factory
// ============================================================================

export interface CreateUnifiedAppResult {
  app: UnifiedApp | null;
  isConnected: boolean;
  error: Error | null;
  platform: Platform;
}

/**
 * Create a unified app - automatically detects platform and creates appropriate adapter
 *
 * For OpenAI: Returns immediately with the adapter
 * For MCP: Returns null app (use the React hook instead for MCP)
 */
export function createUnifiedApp(options: UnifiedAppOptions): CreateUnifiedAppResult {
  const platform = detectPlatform();

  if (platform === "openai") {
    try {
      const app = createOpenAIAdapter(options);
      return {
        app,
        isConnected: true,
        error: null,
        platform: "openai",
      };
    } catch (error) {
      return {
        app: null,
        isConnected: false,
        error: error as Error,
        platform: "openai",
      };
    }
  }

  // For MCP, return null - the React hook will handle connection
  return {
    app: null,
    isConnected: false,
    error: null,
    platform: "unknown",
  };
}
