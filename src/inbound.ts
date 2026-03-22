import type { HubMessage, HubMessagePayload } from "./types.js";

export type InboundEnvelope = {
  senderId: string;
  senderLabel: string;
  groupId: string | null;
  text: string;
  messageId: string;
  timestamp: number;
  contextToken: string;
  mediaUrls: string[];
};

// Deduplication set — process-level, memory-only
const processedIds = new Set<string>();
const MAX_DEDUP_SIZE = 10_000;

export function isDuplicate(externalId: string): boolean {
  if (!externalId) return false;
  if (processedIds.has(externalId)) return true;
  // Evict oldest entries if set grows too large
  if (processedIds.size >= MAX_DEDUP_SIZE) {
    const first = processedIds.values().next().value;
    if (first !== undefined) processedIds.delete(first);
  }
  processedIds.add(externalId);
  return false;
}

export function parseInbound(msg: HubMessage): InboundEnvelope | null {
  if (msg.direction !== "inbound") return null;

  let text = "";
  const mediaUrls: string[] = [];

  try {
    const payload: HubMessagePayload = JSON.parse(msg.payload || "{}");

    if (payload.content) {
      text = payload.content;
    }

    if (payload.items) {
      for (const item of payload.items) {
        switch (item.type) {
          case "text":
            if (item.text) {
              text += (text ? "\n" : "") + item.text;
            }
            break;
          case "image":
          case "voice":
          case "file":
          case "video":
            if (item.media?.url) {
              mediaUrls.push(item.media.url);
            }
            if (item.text) {
              text += (text ? "\n" : "") + `[${item.type}] ${item.text}`;
            }
            break;
        }
      }
    }
  } catch {
    // Fallback: treat entire payload as text
    text = msg.payload || "";
  }

  if (!text && mediaUrls.length === 0) return null;

  const timestamp = msg.createdAt
    ? new Date(msg.createdAt).getTime()
    : Date.now();

  return {
    senderId: msg.sender || "unknown",
    senderLabel: msg.sender || "WeChat User",
    groupId: msg.groupId || null,
    text,
    messageId: msg.externalId || String(msg.id),
    timestamp,
    contextToken: msg.contextToken || "",
    mediaUrls,
  };
}
