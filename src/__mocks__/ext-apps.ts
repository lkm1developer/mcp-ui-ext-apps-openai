// Mock for @modelcontextprotocol/ext-apps
export class App {
  onteardown: any;
  ontoolinput: any;
  ontoolresult: any;
  onerror: any;
  onhostcontextchanged: any;

  constructor(appInfo: any, capabilities: any) {}

  async connect(transport: any) {}

  getHostContext() {
    return null;
  }
}

export class PostMessageTransport {
  constructor(target: any, source: any) {}
}

export type McpUiAppCapabilities = Record<string, unknown>;
