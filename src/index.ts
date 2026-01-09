/**
 * @file mcp-ui-ext-apps-openai - Unified utility for OpenAI ChatGPT and MCP Apps
 *
 * This package provides a unified interface for building apps that work on both
 * OpenAI's ChatGPT platform and MCP Apps hosts.
 *
 * @example
 * ```ts
 * // Core utilities (no React dependency)
 * import { detectPlatform, isOpenAI, isMCP, createUnifiedApp } from "mcp-ui-ext-apps-openai";
 *
 * // Check platform
 * if (isOpenAI()) {
 *   console.log("Running on OpenAI ChatGPT");
 * }
 *
 * // Create unified app (for non-React usage)
 * const { app, isConnected, platform } = createUnifiedApp({
 *   appInfo: { name: "My App", version: "1.0.0" },
 * });
 * ```
 */

// Core types and utilities
export {
  type Platform,
  type UnifiedApp,
  type UnifiedAppOptions,
  type UnifiedHostContext,
  type UnifiedMessage,
  type UnifiedToolResult,
  type OpenAIGlobal,
  type OpenAIWidgetProps,
  type CreateUnifiedAppResult,
  detectPlatform,
  isOpenAI,
  isMCP,
  createOpenAIAdapter,
  createMCPAdapter,
  createUnifiedApp,
} from "./unified-app";
