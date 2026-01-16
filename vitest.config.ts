import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@modelcontextprotocol/ext-apps": new URL(
        "./src/__mocks__/ext-apps.ts",
        import.meta.url
      ).pathname,
    },
  },
});
