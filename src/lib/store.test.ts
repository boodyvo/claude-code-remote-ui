import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      sessionMessages: {},
      loadingSessions: false,
      streamBuffer: "",
      isStreaming: false,
      pendingToolApprovals: [],
      isRecording: false,
      interimTranscript: "",
      audioLevel: 0,
      sidebarOpen: false,
      activeTab: "chat",
      theme: "system",
      connectionState: "disconnected",
    });
  });

  it("initializes with correct defaults", () => {
    const state = useAppStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.activeSessionId).toBeNull();
    expect(state.sessionMessages).toEqual({});
    expect(state.isStreaming).toBe(false);
    expect(state.isRecording).toBe(false);
    expect(state.activeTab).toBe("chat");
    expect(state.theme).toBe("system");
    expect(state.connectionState).toBe("disconnected");
  });

  it("adds a message to a session", () => {
    const { addMessage } = useAppStore.getState();
    addMessage("session-1", { type: "user", content: [{ type: "text", text: "hello" }] });

    const messages = useAppStore.getState().sessionMessages["session-1"];
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("user");
  });

  it("appends stream tokens and commits", () => {
    const store = useAppStore.getState();
    store.appendStreamToken("Hello");
    store.appendStreamToken(" world");

    expect(useAppStore.getState().streamBuffer).toBe("Hello world");

    store.commitStream("session-1");

    const state = useAppStore.getState();
    expect(state.streamBuffer).toBe("");
    expect(state.isStreaming).toBe(false);
    expect(state.sessionMessages["session-1"]).toHaveLength(1);
  });

  it("adds and resolves tool approvals", () => {
    const store = useAppStore.getState();
    store.addToolApproval({
      toolUseId: "tool-1",
      toolName: "Edit",
      input: { file_path: "/test.ts" },
      status: "pending",
      timestamp: Date.now(),
    });

    expect(useAppStore.getState().pendingToolApprovals).toHaveLength(1);
    expect(useAppStore.getState().pendingToolApprovals[0].status).toBe("pending");

    store.resolveToolApproval("tool-1", "approved");
    expect(useAppStore.getState().pendingToolApprovals[0].status).toBe("approved");
  });

  it("sets UI state correctly", () => {
    const store = useAppStore.getState();

    store.setSidebarOpen(true);
    expect(useAppStore.getState().sidebarOpen).toBe(true);

    store.setActiveTab("files");
    expect(useAppStore.getState().activeTab).toBe("files");

    store.setTheme("dark");
    expect(useAppStore.getState().theme).toBe("dark");

    store.setConnectionState("connected");
    expect(useAppStore.getState().connectionState).toBe("connected");
  });
});
