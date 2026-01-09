/**
 * @file React hook for unified OpenAI/MCP app usage
 *
 * This hook provides a unified interface for apps that need to run on both
 * OpenAI ChatGPT and MCP Apps platforms.
 */

import type { App, McpUiAppCapabilities } from "@modelcontextprotocol/ext-apps";
import { PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMCPAdapter,
  createOpenAIAdapter,
  detectPlatform,
  type Platform,
  type UnifiedApp,
  type UnifiedHostContext,
  type UnifiedToolResult,
} from "./unified-app";

export interface UseUnifiedAppOptions {
  appInfo: { name: string; version: string };
  capabilities?: McpUiAppCapabilities;
  onToolInput?: (input: unknown) => void | Promise<void>;
  onToolResult?: (result: UnifiedToolResult) => void | Promise<void>;
  onHostContextChanged?: (context: UnifiedHostContext) => void;
  onTeardown?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

export interface UseUnifiedAppResult {
  /** The unified app instance */
  app: UnifiedApp | null;
  /** Whether the app is connected to the host */
  isConnected: boolean;
  /** Any connection error */
  error: Error | null;
  /** The detected platform */
  platform: Platform;
  /** Current host context (theme, displayMode, locale, etc.) */
  hostContext: UnifiedHostContext | undefined;
  /** Initial props from toolOutput (OpenAI only, undefined on MCP) - use as initial data for component */
  initialProps: unknown;
  /** Widget props (OpenAI only, reactive) */
  widgetProps: Record<string, unknown>;
  /** Widget state - works on both platforms via React state */
  widgetState: unknown;
  /** Set widget state - works on both platforms (also syncs to OpenAI if on that platform) */
  setWidgetState: <T = unknown>(state: T) => void;
  /** Update widget state partially - works on both platforms */
  updateWidgetState: <T = unknown>(state: Partial<T>) => void;
}

/**
 * Hook to subscribe to OpenAI global property changes
 * Listens for 'openai:set_globals' events
 */
function useOpenAIGlobal<T>(key: string, initialValue: T): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window === "undefined" || !window.openai) return;

    // Get initial value - cast to unknown first then to Record
    const openai = window.openai as unknown as Record<string, unknown>;
    if (key in openai) {
      setValue(openai[key] as T);
    }

    // Listen for changes
    const handleChange = () => {
      const currentOpenai = window.openai as unknown as Record<string, unknown>;
      if (currentOpenai && key in currentOpenai) {
        setValue(currentOpenai[key] as T);
      }
    };

    window.addEventListener("openai:set_globals", handleChange);
    return () => window.removeEventListener("openai:set_globals", handleChange);
  }, [key]);

  return value;
}

/**
 * React hook that provides a unified app interface for both OpenAI and MCP platforms
 *
 * @example
 * ```tsx
 * function MyApp() {
 *   const {
 *     app,
 *     isConnected,
 *     platform,
 *     hostContext,
 *     widgetState,
 *     setWidgetState,
 *   } = useUnifiedApp({
 *     appInfo: { name: "My App", version: "1.0.0" },
 *     capabilities: {},
 *     onError: console.error,
 *   });
 *
 *   const counter = (widgetState as { value?: number } | null)?.value ?? 0;
 *
 *   return (
 *     <div>
 *       <p>Running on: {platform}</p>
 *       <p>Counter: {counter}</p>
 *       <button onClick={() => setWidgetState({ value: counter + 1 })}>
 *         Increment
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUnifiedApp(options: UseUnifiedAppOptions): UseUnifiedAppResult {
  // Detect platform once on mount
  const platformRef = useRef<Platform>(detectPlatform());
  const platform = platformRef.current;

  const [unifiedApp, setUnifiedApp] = useState<UnifiedApp | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hostContext, setHostContext] = useState<UnifiedHostContext | undefined>();

  // React state for widgetState - works on both platforms
  const [localWidgetState, setLocalWidgetState] = useState<unknown>(null);

  // OpenAI reactive globals
  const openaiWidgetState = useOpenAIGlobal<unknown>("widgetState", null);
  const openaiWidgetProps = useOpenAIGlobal<Record<string, unknown>>("widget", {});
  const openaiToolOutput = useOpenAIGlobal<unknown>("toolOutput", undefined);
  const openaiTheme = useOpenAIGlobal<"light" | "dark">("theme", "light");
  const openaiDisplayMode = useOpenAIGlobal<string>("displayMode", "inline");
  const openaiLocale = useOpenAIGlobal<string>("locale", "en-US");

  // Store options in ref to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Sync OpenAI widgetState to local state when it changes
  useEffect(() => {
    if (platform === "openai" && openaiWidgetState !== null) {
      setLocalWidgetState(openaiWidgetState);
    }
  }, [platform, openaiWidgetState]);

  // Widget state setters - work on both platforms via React state
  // Also syncs to OpenAI if on that platform
  const setWidgetState = useCallback(<T = unknown>(state: T) => {
    setLocalWidgetState(state);
    if (unifiedApp && platform === "openai") {
      unifiedApp.setWidgetState(state);
    }
  }, [unifiedApp, platform]);

  const updateWidgetState = useCallback(<T = unknown>(state: Partial<T>) => {
    setLocalWidgetState((prev: unknown) => ({ ...(prev as object), ...state }));
    if (unifiedApp && platform === "openai") {
      unifiedApp.updateWidgetState(state);
    }
  }, [unifiedApp, platform]);

  // Update host context from OpenAI globals
  useEffect(() => {
    if (platform === "openai" && isConnected) {
      setHostContext({
        theme: openaiTheme,
        displayMode: openaiDisplayMode as UnifiedHostContext["displayMode"],
        locale: openaiLocale,
        safeAreaInsets: window.openai?.safeArea?.insets,
        maxWidth: window.openai?.maxWidth,
        maxHeight: window.openai?.maxHeight,
      });
    }
  }, [platform, isConnected, openaiTheme, openaiDisplayMode, openaiLocale]);

  useEffect(() => {
    let mounted = true;
    let mcpApp: App | null = null;

    async function initialize() {
      const opts = optionsRef.current;

      if (platform === "openai") {
        // OpenAI platform - use the adapter directly
        try {
          const adapter = createOpenAIAdapter({
            ...opts,
            onToolResult: (result) => {
              opts.onToolResult?.(result);
            },
            onHostContextChanged: (ctx) => {
              if (mounted) {
                setHostContext(ctx);
                opts.onHostContextChanged?.(ctx);
              }
            },
            onError: (err) => {
              console.error(`[${opts.appInfo.name}]`, err);
              opts.onError?.(err);
            },
          });

          if (mounted) {
            setUnifiedApp(adapter);
            setIsConnected(true);
            setHostContext(adapter.getHostContext());
          }
        } catch (err) {
          console.error(`[${opts.appInfo.name}]`, err);
          if (mounted) {
            setError(err as Error);
            setIsConnected(false);
          }
        }
      } else {
        // MCP platform - need to dynamically import and create connection
        try {
          // Dynamic import to avoid issues when running on OpenAI
          const { App } = await import("@modelcontextprotocol/ext-apps");

          const transport = new PostMessageTransport(window.parent, window.parent);
          mcpApp = new App(opts.appInfo, opts.capabilities || {});

          // Set up handlers before connecting
          mcpApp.onteardown = async () => {
            await opts.onTeardown?.();
            return {};
          };

          mcpApp.ontoolinput = async (input) => {
            await opts.onToolInput?.(input);
          };

          mcpApp.ontoolresult = async (result) => {
            await opts.onToolResult?.(result as UnifiedToolResult);
          };

          mcpApp.onerror = (err) => {
            console.error(`[${opts.appInfo.name}]`, err);
            opts.onError?.(err instanceof Error ? err : new Error(String(err)));
          };

          mcpApp.onhostcontextchanged = (params) => {
            if (mounted) {
              setHostContext((prev) => {
                const newCtx = { ...prev, ...params } as UnifiedHostContext;
                opts.onHostContextChanged?.(newCtx);
                return newCtx;
              });
            }
          };

          await mcpApp.connect(transport);

          if (mounted) {
            const adapter = createMCPAdapter(mcpApp, opts);
            setUnifiedApp(adapter);
            setIsConnected(true);

            // Get initial host context
            const ctx = mcpApp.getHostContext();
            if (ctx) {
              setHostContext({
                theme: ctx.theme as UnifiedHostContext["theme"],
                displayMode: ctx.displayMode as UnifiedHostContext["displayMode"],
                locale: ctx.locale,
                safeAreaInsets: ctx.safeAreaInsets,
              });
            }
          }
        } catch (err) {
          console.error(`[${opts.appInfo.name}]`, err);
          if (mounted) {
            setError(err instanceof Error ? err : new Error("Failed to connect"));
            setIsConnected(false);
          }
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      // Note: MCP App cleanup would go here if needed
    };
  }, [platform]);

  // Determine final platform based on connection state
  const finalPlatform: Platform = useMemo(() => {
    if (platform === "openai") return "openai";
    if (isConnected) return "mcp";
    return "unknown";
  }, [platform, isConnected]);

  // Return platform-appropriate values
  const widgetProps = platform === "openai" ? ((openaiWidgetProps as { props?: Record<string, unknown> })?.props || {}) : {};
  const initialProps = platform === "openai" ? openaiToolOutput : undefined;

  return {
    app: unifiedApp,
    isConnected,
    error,
    platform: finalPlatform,
    hostContext,
    initialProps,
    widgetProps,
    widgetState: localWidgetState,
    setWidgetState,
    updateWidgetState,
  };
}

export default useUnifiedApp;
