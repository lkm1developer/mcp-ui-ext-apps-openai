/**
 * @file React bindings for mcp-ui-ext-apps-openai
 *
 * @example
 * ```tsx
 * import { useUnifiedApp } from "mcp-ui-ext-apps-openai/react";
 *
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
 *     onError: console.error,
 *   });
 *
 *   const counter = (widgetState as { value?: number } | null)?.value ?? 0;
 *
 *   return (
 *     <div>
 *       <p>Platform: {platform}</p>
 *       <p>Counter: {counter}</p>
 *       <button onClick={() => setWidgetState({ value: counter + 1 })}>+</button>
 *     </div>
 *   );
 * }
 * ```
 */

// Re-export everything from core
export * from "./index";

// React hook
export {
  useUnifiedApp,
  type UseUnifiedAppOptions,
  type UseUnifiedAppResult,
} from "./use-unified-app";
