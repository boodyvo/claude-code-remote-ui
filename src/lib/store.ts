import { create } from "zustand";
import type { SessionInfo, SDKMessage, ToolApproval, ActiveTab, Theme } from "./types";

interface AppState {
  // Sessions
  sessions: SessionInfo[];
  activeSessionId: string | null;
  sessionMessages: Record<string, SDKMessage[]>;
  loadingSessions: boolean;

  // Streaming
  streamBuffer: string;
  isStreaming: boolean;

  // Tool approvals
  pendingToolApprovals: ToolApproval[];

  // Voice
  isRecording: boolean;
  interimTranscript: string;
  finalTranscript: string;
  voiceState: "idle" | "recording" | "confirming";
  audioLevel: number;

  // UI
  sidebarOpen: boolean;
  activeTab: ActiveTab;
  theme: Theme;
  connectionState: "connected" | "reconnecting" | "disconnected";

  // Session actions
  setSessions: (sessions: SessionInfo[]) => void;
  setActiveSessionId: (id: string | null) => void;
  addMessage: (sessionId: string, message: SDKMessage) => void;
  setSessionMessages: (sessionId: string, messages: SDKMessage[]) => void;
  clearSessionMessages: (sessionId: string) => void;
  setLoadingSessions: (loading: boolean) => void;

  // Streaming actions
  appendStreamToken: (token: string) => void;
  commitStream: (sessionId: string) => void;
  setIsStreaming: (streaming: boolean) => void;

  // Tool approval actions
  addToolApproval: (approval: ToolApproval) => void;
  resolveToolApproval: (toolUseId: string, status: "approved" | "rejected") => void;

  // Voice actions
  setRecording: (recording: boolean) => void;
  setInterimTranscript: (text: string) => void;
  appendFinalTranscript: (text: string) => void;
  setVoiceState: (state: "idle" | "recording" | "confirming") => void;
  resetVoice: () => void;
  setAudioLevel: (level: number) => void;

  // UI actions
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setTheme: (theme: Theme) => void;
  setConnectionState: (state: "connected" | "reconnecting" | "disconnected") => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // Initial state
  sessions: [],
  activeSessionId: null,
  sessionMessages: {},
  loadingSessions: false,
  streamBuffer: "",
  isStreaming: false,
  pendingToolApprovals: [],
  isRecording: false,
  interimTranscript: "",
  finalTranscript: "",
  voiceState: "idle",
  audioLevel: 0,
  sidebarOpen: false,
  activeTab: "chat",
  theme: "system",
  connectionState: "disconnected",

  // Session actions
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  addMessage: (sessionId, message) =>
    set((state) => ({
      sessionMessages: {
        ...state.sessionMessages,
        [sessionId]: [...(state.sessionMessages[sessionId] || []), message],
      },
    })),
  setSessionMessages: (sessionId, messages) =>
    set((state) => ({
      sessionMessages: {
        ...state.sessionMessages,
        [sessionId]: messages,
      },
    })),
  clearSessionMessages: (sessionId) =>
    set((state) => {
      const next = { ...state.sessionMessages };
      delete next[sessionId];
      return { sessionMessages: next };
    }),
  setLoadingSessions: (loading) => set({ loadingSessions: loading }),

  // Streaming actions
  appendStreamToken: (token) =>
    set((state) => ({ streamBuffer: state.streamBuffer + token })),
  commitStream: (sessionId) => {
    const { streamBuffer, sessionMessages } = get();
    if (!streamBuffer) return;
    const message: SDKMessage = {
      type: "assistant",
      content: [{ type: "text", text: streamBuffer }],
    };
    set({
      sessionMessages: {
        ...sessionMessages,
        [sessionId]: [...(sessionMessages[sessionId] || []), message],
      },
      streamBuffer: "",
      isStreaming: false,
    });
  },
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  // Tool approval actions
  addToolApproval: (approval) =>
    set((state) => ({
      pendingToolApprovals: [...state.pendingToolApprovals, approval],
    })),
  resolveToolApproval: (toolUseId, status) =>
    set((state) => ({
      pendingToolApprovals: state.pendingToolApprovals.map((a) =>
        a.toolUseId === toolUseId ? { ...a, status } : a,
      ),
    })),

  // Voice actions
  setRecording: (recording) => set({ isRecording: recording }),
  setInterimTranscript: (text) => set({ interimTranscript: text }),
  appendFinalTranscript: (text) =>
    set((state) => ({
      finalTranscript: state.finalTranscript
        ? `${state.finalTranscript} ${text}`
        : text,
    })),
  setVoiceState: (voiceState) => set({ voiceState }),
  resetVoice: () =>
    set({
      isRecording: false,
      interimTranscript: "",
      finalTranscript: "",
      voiceState: "idle",
      audioLevel: 0,
    }),
  setAudioLevel: (level) => set({ audioLevel: level }),

  // UI actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTheme: (theme) => set({ theme }),
  setConnectionState: (state) => set({ connectionState: state }),
}));
