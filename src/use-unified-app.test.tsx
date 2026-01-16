import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUnifiedApp } from "./use-unified-app";

describe("useUnifiedApp - OpenAI Platform", () => {
  beforeEach(() => {
    // Clear any existing window.openai
    delete (window as any).openai;
  });

  it("should initialize widgetState from toolOutput on OpenAI platform", async () => {
    // Mock OpenAI window object with toolOutput
    const mockToolOutput = {
      status: true,
      amenities: ["WiFi", "Pool", "Gym", "Spa"],
      hotelName: "Grand Hotel",
      roomCount: 150,
    };

    (window as any).openai = {
      toolOutput: mockToolOutput,
      widgetState: null,
      widget: {},
      theme: "light",
      displayMode: "inline",
      locale: "en-US",
    };

    // Render the hook
    const { result } = renderHook(() =>
      useUnifiedApp({
        appInfo: { name: "Test App", version: "1.0.0" },
      })
    );

    // Wait for the hook to initialize
    await waitFor(() => {
      expect(result.current.widgetState).toEqual(mockToolOutput);
    });

    // Verify the widget state matches the toolOutput
    expect(result.current.widgetState).toEqual(mockToolOutput);
    expect(result.current.platform).toBe("openai");
    expect(result.current.isConnected).toBe(true);
  });

  it("should handle null toolOutput gracefully", async () => {
    // Mock OpenAI window object without toolOutput
    (window as any).openai = {
      toolOutput: null,
      widgetState: null,
      widget: {},
      theme: "light",
      displayMode: "inline",
      locale: "en-US",
    };

    const { result } = renderHook(() =>
      useUnifiedApp({
        appInfo: { name: "Test App", version: "1.0.0" },
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.widgetState).toBeNull();
    expect(result.current.platform).toBe("openai");
  });

  it("should update widgetState when setWidgetState is called", async () => {
    const mockToolOutput = { counter: 0 };

    (window as any).openai = {
      toolOutput: mockToolOutput,
      widgetState: mockToolOutput,
      widget: {},
      theme: "light",
      displayMode: "inline",
      locale: "en-US",
      setWidgetState: vi.fn(),
    };

    const { result } = renderHook(() =>
      useUnifiedApp({
        appInfo: { name: "Test App", version: "1.0.0" },
      })
    );

    await waitFor(() => {
      expect(result.current.widgetState).toEqual(mockToolOutput);
    });

    // Update widget state
    const newState = { counter: 1 };
    result.current.setWidgetState(newState);

    await waitFor(() => {
      expect(result.current.widgetState).toEqual(newState);
    });
  });

  it("should partially update widgetState when updateWidgetState is called", async () => {
    const mockToolOutput = { counter: 0, name: "Test" };

    (window as any).openai = {
      toolOutput: mockToolOutput,
      widgetState: mockToolOutput,
      widget: {},
      theme: "light",
      displayMode: "inline",
      locale: "en-US",
      setWidgetState: vi.fn(),
      updateWidgetState: vi.fn(),
    };

    const { result } = renderHook(() =>
      useUnifiedApp({
        appInfo: { name: "Test App", version: "1.0.0" },
      })
    );

    await waitFor(() => {
      expect(result.current.widgetState).toEqual(mockToolOutput);
    });

    // Partially update widget state
    result.current.updateWidgetState({ counter: 5 });

    await waitFor(() => {
      expect(result.current.widgetState).toEqual({ counter: 5, name: "Test" });
    });
  });

  it("should sync widgetState from openai.widgetState when it changes externally", async () => {
    const initialState = { value: 1 };

    (window as any).openai = {
      toolOutput: initialState,
      widgetState: initialState,
      widget: {},
      theme: "light",
      displayMode: "inline",
      locale: "en-US",
    };

    const { result } = renderHook(() =>
      useUnifiedApp({
        appInfo: { name: "Test App", version: "1.0.0" },
      })
    );

    await waitFor(() => {
      expect(result.current.widgetState).toEqual(initialState);
    });

    // Simulate external update to openai.widgetState
    const newState = { value: 2 };
    (window as any).openai.widgetState = newState;

    // Trigger the openai:set_globals event
    window.dispatchEvent(new Event("openai:set_globals"));

    await waitFor(() => {
      expect(result.current.widgetState).toEqual(newState);
    });
  });

  it("should extract widgetProps from openai.widget.props", async () => {
    const mockProps = { theme: "dark", userId: "123" };

    (window as any).openai = {
      toolOutput: null,
      widgetState: null,
      widget: { props: mockProps },
      theme: "light",
      displayMode: "inline",
      locale: "en-US",
    };

    const { result } = renderHook(() =>
      useUnifiedApp({
        appInfo: { name: "Test App", version: "1.0.0" },
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.widgetProps).toEqual(mockProps);
  });

  it("should initialize from widgetState if toolOutput is undefined", async () => {
    const mockWidgetState = { initialized: true };

    (window as any).openai = {
      toolOutput: undefined,
      widgetState: mockWidgetState,
      widget: {},
      theme: "light",
      displayMode: "inline",
      locale: "en-US",
    };

    const { result } = renderHook(() =>
      useUnifiedApp({
        appInfo: { name: "Test App", version: "1.0.0" },
      })
    );

    await waitFor(() => {
      expect(result.current.widgetState).toEqual(mockWidgetState);
    });

    expect(result.current.widgetState).toEqual(mockWidgetState);
  });
});
