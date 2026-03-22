import type { ChannelPlugin } from "openclaw/plugin-sdk";

// --- Hub API types ---

export type HubMessage = {
  id: number;
  botId: string;
  channelId: string;
  direction: "inbound" | "outbound";
  sender: string;
  recipient: string;
  groupId: string;
  msgType: string;
  payload: string;
  externalId: string;
  contextToken: string;
  createdAt: string;
};

export type HubMessagePayload = {
  content?: string;
  items?: HubMessageItem[];
};

export type HubMessageItem = {
  type: "text" | "image" | "voice" | "file" | "video";
  text?: string;
  file_name?: string;
  media?: {
    url?: string;
    aes_key?: string;
    file_size?: number;
    media_type?: string;
    play_time?: number;
  };
};

export type HubMessagesResponse = {
  messages: HubMessage[];
  next_cursor: string;
};

export type HubSendResponse = {
  ok: boolean;
  client_id?: string;
  error?: string;
};

export type HubStatusResponse = {
  channel_id: string;
  channel_name: string;
  bot_id: string;
  bot_status: string;
};

// --- WebSocket types ---

export type WsInboundFrame = {
  type: "message";
  data: HubMessage;
} | {
  type: "status";
  data: { bot_status: string };
} | {
  type: "ping";
};

// --- Plugin config types ---

export type OpenILinkAccountConfig = {
  hubUrl: string;
  apiKey: string;
  botId?: string;
  enabled?: boolean;
  dmPolicy?: "pairing" | "allowlist" | "open";
  allowFrom?: string[];
};

export type ResolvedAccount = {
  accountId: string;
  hubUrl: string;
  apiKey: string;
  botId: string;
  enabled: boolean;
  dmPolicy: string;
  allowFrom: string[];
};

export type OpenILinkChannelPlugin = ChannelPlugin<ResolvedAccount>;
