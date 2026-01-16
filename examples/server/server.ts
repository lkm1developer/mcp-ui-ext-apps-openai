import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE as STANDARD_RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY as STANDARD_RESOURCE_URI_META_KEY
} from "@modelcontextprotocol/ext-apps/server";
import * as z from "zod";

// ==================== FORMAT CONSTANTS ====================

const OPENAI_MIME_TYPE = "text/html+skybridge";
const OPENAI_RESOURCE_URI_KEY = "openai/outputTemplate";

// ==================== TYPES ====================

type Widget = {
  id: string;
  title: string;
  description: string;
  templateUri: string;
  invoking?: string;
  invoked?: string;
  responseText?: string;
  inputSchema?: Record<string, any>;
};

type ServerSession = {
  server: McpServer;
  isOpenAI: boolean;
  createdAt: number;
  lastUsed: number;
};

type FormatConfig = {
  isOpenAI: boolean;
  mimeType: string;
  resourceUriKey: string;
};

// ==================== PATHS ====================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, "..", "ui", "dist");

// ==================== IN-MEMORY COUNTER STORE ====================

let counterValue = 0;

// ==================== SESSION MANAGEMENT ====================

const serverSessions = new Map<string, ServerSession>();
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ==================== FORMAT HELPER FUNCTIONS ====================

function isOpenAIClient(userAgent: string | undefined): boolean {
  return userAgent?.toLowerCase().includes("openai") ?? false;
}

function getSessionKey(isOpenAI: boolean): string {
  return isOpenAI ? "openai" : "standard";
}

function getFormatConfig(isOpenAI: boolean): FormatConfig {
  return {
    isOpenAI,
    mimeType: isOpenAI ? OPENAI_MIME_TYPE : STANDARD_RESOURCE_MIME_TYPE,
    resourceUriKey: isOpenAI ? OPENAI_RESOURCE_URI_KEY : STANDARD_RESOURCE_URI_META_KEY,
  };
}

function buildToolMeta(widget: Widget, format: FormatConfig): Record<string, any> {
  const meta: Record<string, any> = {
    [format.resourceUriKey]: widget.templateUri,
  };

  if (format.isOpenAI && widget.invoking && widget.invoked) {
    meta["openai/toolInvocation/invoking"] = widget.invoking;
    meta["openai/toolInvocation/invoked"] = widget.invoked;
    meta["openai/widgetAccessible"] = true;
  }

  return meta;
}

function buildInvocationMeta(widget: Widget, format: FormatConfig): Record<string, any> {
  const meta: Record<string, any> = {};

  if (format.isOpenAI) {
    meta[format.resourceUriKey] = widget.templateUri;

    if (widget.invoking && widget.invoked) {
      meta["openai/toolInvocation/invoking"] = widget.invoking;
      meta["openai/toolInvocation/invoked"] = widget.invoked;
    }
  }

  return meta;
}

function formatToolResponse(
  widget: Widget,
  structuredContent: Record<string, any>,
  format: FormatConfig
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: widget.responseText || `${widget.title}`,
      },
    ],
    structuredContent,
    _meta: buildInvocationMeta(widget, format),
  };
}

// ==================== WIDGET CONFIGURATION ====================

const widget: Widget = {
  id: "counter",
  title: "Counter",
  description: "A simple counter widget that displays and manages a counter value.",
  templateUri: "ui://widget/counter.html",
  invoking: "Loading counter...",
  invoked: "Counter loaded!",
  responseText: "Counter widget rendered",
};

// ==================== WIDGET HTML LOADER ====================

async function findWidgetHtml(): Promise<string> {
  const directPath = path.join(ASSETS_DIR, "index.html");
  console.log(`[counter-server] Fetching: ${directPath}`);
  return await fs.readFile(directPath, "utf8");
}

// ==================== MCP SERVER CREATION ====================

function createMcpServer(isOpenAI: boolean): McpServer {
  const formatType = isOpenAI ? "OpenAI" : "Standard";
  console.log(`[counter-server] Creating NEW ${formatType} server instance`);

  const server = new McpServer({
    name: `counter-server-${formatType.toLowerCase()}`,
    version: "1.0.0",
  });

  const format = getFormatConfig(isOpenAI);

  // Register counter widget tool + resource
  registerAppTool(
    server,
    widget.id,
    {
      title: widget.title,
      description: widget.description,
      inputSchema: widget.inputSchema || {},
      _meta: buildToolMeta(widget, format),
    },
    async (): Promise<CallToolResult> => {
      console.log(`[counter-server] counter tool called, value: ${counterValue}`);
      return formatToolResponse(
        widget,
        { status: true, value: counterValue },
        format
      );
    }
  );

  // Register resource for counter widget HTML
  registerAppResource(
    server,
    widget.templateUri,
    widget.templateUri,
    {
      mimeType: format.mimeType,
      description: widget.description,
      _meta: {
        ui: {},
        ...buildToolMeta(widget, format),
      },
    },
    async (): Promise<ReadResourceResult> => {
      const html = await findWidgetHtml();
      return {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: format.mimeType,
            text: html,
            _meta: buildToolMeta(widget, format),
          },
        ],
      };
    }
  );

  // Register get-counter tool
  server.registerTool(
    "get-counter",
    {
      title: "Get Counter",
      description: "Gets the current counter value from the database",
      inputSchema: z.object({}),
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
    },
    async (): Promise<CallToolResult> => {
      console.log(`[counter-server] get-counter called, value: ${counterValue}`);
      return {
        content: [{ type: "text", text: `Counter value is ${counterValue}` }],
        structuredContent: {
          status: true,
          value: counterValue,
        },
      };
    }
  );

  // Register set-counter tool
  server.registerTool(
    "set-counter",
    {
      title: "Set Counter",
      description: "Sets the counter value in the database",
      inputSchema: z.object({
        value: z.number().int().describe("The new counter value"),
      }),
      annotations: {
        destructiveHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      const { value } = args;
      counterValue = value;
      console.log(`[counter-server] set-counter called, new value: ${counterValue}`);
      return {
        content: [{ type: "text", text: `Counter set to ${counterValue}` }],
        structuredContent: {
          status: true,
          value: counterValue,
        },
      };
    }
  );

  console.log(`[counter-server] Server created with tools: counter, get-counter, set-counter in ${formatType} format`);
  return server;
}

// ==================== SESSION MANAGEMENT ====================

async function getOrCreateSession(isOpenAI: boolean): Promise<ServerSession> {
  const sessionKey = getSessionKey(isOpenAI);
  const existing = serverSessions.get(sessionKey);
  const now = Date.now();

  if (existing) {
    if (now - existing.lastUsed > SESSION_TIMEOUT) {
      console.log(`[counter-server] Session ${sessionKey} expired, creating new one`);
      await existing.server.close().catch(() => {});
      serverSessions.delete(sessionKey);
    } else {
      console.log(`[counter-server] Reusing existing ${sessionKey} session`);
      existing.lastUsed = now;
      return existing;
    }
  }

  console.log(`[counter-server] Creating new ${sessionKey} session`);
  const server = createMcpServer(isOpenAI);
  const session: ServerSession = {
    server,
    isOpenAI,
    createdAt: now,
    lastUsed: now,
  };

  serverSessions.set(sessionKey, session);
  return session;
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of serverSessions.entries()) {
    if (now - session.lastUsed > SESSION_TIMEOUT) {
      console.log(`[counter-server] Cleaning up expired session: ${key}`);
      session.server.close().catch(() => {});
      serverSessions.delete(key);
    }
  }
}, 60000);

// ==================== EXPRESS SERVER ====================

const port = parseInt(process.env.PORT || "7007", 10);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  const userAgent = req.headers["user-agent"];
  const isOpenAI = isOpenAIClient(userAgent);

  res.json({
    name: "counter-server",
    version: "1.0.0",
    transport: "streamable-http",
    mode: "stateful",
    detectedClient: isOpenAI ? "OpenAI" : "Standard MCP",
    userAgent: userAgent,
    activeSessions: serverSessions.size,
    sessions: Array.from(serverSessions.entries()).map(([key, session]) => ({
      key,
      format: session.isOpenAI ? "OpenAI" : "Standard",
      ageMs: Date.now() - session.createdAt,
      idleMs: Date.now() - session.lastUsed,
    })),
    formats: {
      openai: {
        mimeType: OPENAI_MIME_TYPE,
        resourceUriKey: OPENAI_RESOURCE_URI_KEY,
      },
      standard: {
        mimeType: STANDARD_RESOURCE_MIME_TYPE,
        resourceUriKey: STANDARD_RESOURCE_URI_META_KEY,
      },
    },
    tools: ["counter", "get-counter", "set-counter"],
    endpoint: `http://localhost:${port}/mcp`,
    status: "running",
  });
});

app.all("/mcp", async (req: Request, res: Response) => {
  const userAgent = req.headers["user-agent"];
  const isOpenAI = isOpenAIClient(userAgent);

  console.log(`[counter-server] ${req.method} request to /mcp`);
  console.log(`[counter-server] User-Agent: ${userAgent}`);
  console.log(`[counter-server] Format: ${isOpenAI ? "OpenAI" : "Standard"}`);

  const session = await getOrCreateSession(isOpenAI);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
  });

  try {
    await session.server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[counter-server] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const httpServer = app.listen(port, () => {
  console.log(`Counter MCP server listening on http://localhost:${port}`);
  console.log(`  MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`  Server info: http://localhost:${port}/`);
  console.log(`  Mode: STATEFUL - servers persist and are reused`);
  console.log(`  Auto-detects: OpenAI (${OPENAI_MIME_TYPE}) or Standard (${STANDARD_RESOURCE_MIME_TYPE})`);
});

const shutdown = () => {
  console.log("\nShutting down counter-server...");
  for (const [sessionKey, session] of serverSessions.entries()) {
    console.log(`Closing session: ${sessionKey}`);
    session.server.close().catch(() => {});
  }
  serverSessions.clear();
  httpServer.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
