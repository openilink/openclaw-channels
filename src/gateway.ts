import { WebSocket } from "node:stream/web";
import type { ChannelAccountSnapshot } from "openclaw/plugin-sdk";
import { HubClient } from "./hub-client.js";
import type { HubMessage, ResolvedAccount, WsInboundFrame } from "./types.js";

export type GatewayParams = {
  account: ResolvedAccount;
  abortSignal: AbortSignal;
  onMessage: (msg: HubMessage) => void;
  onStatus: (status: string) => void;
  setStatus: (next: Partial<ChannelAccountSnapshot>) => void;
  log?: { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void };
};

const INITIAL_RECONNECT_MS = 2_000;
const MAX_RECONNECT_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MISSED_REPLAY_LIMIT = 100;

export async function startGateway(params: GatewayParams): Promise<void> {
  const { account, abortSignal, onMessage, onStatus, setStatus, log } = params;
  const client = new HubClient(account.hubUrl, account.apiKey);

  // Replay missed messages via REST before connecting WebSocket
  await replayMissedMessages(client, onMessage, log);

  let reconnectMs = INITIAL_RECONNECT_MS;

  while (!abortSignal.aborted) {
    try {
      await connectWebSocket({
        client,
        abortSignal,
        onMessage,
        onStatus,
        setStatus,
        log,
      });
      // Clean disconnect — reset backoff
      reconnectMs = INITIAL_RECONNECT_MS;
    } catch (err) {
      if (abortSignal.aborted) break;

      log?.warn?.(`[openilink] WebSocket error, reconnecting in ${reconnectMs}ms:`, err);
      setStatus({
        connected: false,
        lastError: err instanceof Error ? err.message : String(err),
      });

      await sleep(reconnectMs, abortSignal);
      reconnectMs = Math.min(reconnectMs * 2, MAX_RECONNECT_MS);
    }
  }

  setStatus({ connected: false, running: false });
}

async function replayMissedMessages(
  client: HubClient,
  onMessage: (msg: HubMessage) => void,
  log?: GatewayParams["log"],
): Promise<void> {
  try {
    const resp = await client.getMessages(undefined, MISSED_REPLAY_LIMIT);
    for (const msg of resp.messages) {
      if (msg.direction === "inbound") {
        onMessage(msg);
      }
    }
    if (resp.messages.length > 0) {
      log?.info?.(`[openilink] Replayed ${resp.messages.length} missed messages`);
    }
  } catch (err) {
    log?.warn?.("[openilink] Failed to replay missed messages:", err);
  }
}

type WsConnectParams = {
  client: HubClient;
  abortSignal: AbortSignal;
  onMessage: (msg: HubMessage) => void;
  onStatus: (status: string) => void;
  setStatus: (next: Partial<ChannelAccountSnapshot>) => void;
  log?: GatewayParams["log"];
};

function connectWebSocket(params: WsConnectParams): Promise<void> {
  const { client, abortSignal, onMessage, onStatus, setStatus, log } = params;

  return new Promise<void>((resolve, reject) => {
    const wsUrl = client.buildWsUrl();
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      reject(err);
      return;
    }

    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let alive = true;

    const cleanup = () => {
      alive = false;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try { ws.close(); } catch { /* ignore */ }
    };

    const onAbort = () => {
      cleanup();
      resolve();
    };

    abortSignal.addEventListener("abort", onAbort, { once: true });

    ws.addEventListener("open", () => {
      log?.info?.("[openilink] WebSocket connected");
      setStatus({
        connected: true,
        running: true,
        lastConnectedAt: Date.now(),
        lastError: null,
      });

      // Heartbeat
      heartbeatTimer = setInterval(() => {
        if (alive && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch { /* ignore */ }
        }
      }, HEARTBEAT_INTERVAL_MS);
    });

    ws.addEventListener("message", (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : String(event.data);
        const frame = JSON.parse(raw) as WsInboundFrame;

        if (frame.type === "message" && frame.data) {
          if (frame.data.direction === "inbound") {
            onMessage(frame.data);
          }
        } else if (frame.type === "status" && frame.data) {
          onStatus(frame.data.bot_status);
        }
        // Ignore ping/pong
      } catch (err) {
        log?.warn?.("[openilink] Failed to parse WebSocket frame:", err);
      }
    });

    ws.addEventListener("close", (event) => {
      cleanup();
      abortSignal.removeEventListener("abort", onAbort);
      log?.info?.(`[openilink] WebSocket closed: ${event.code} ${event.reason}`);
      setStatus({ connected: false });
      resolve();
    });

    ws.addEventListener("error", (event) => {
      cleanup();
      abortSignal.removeEventListener("abort", onAbort);
      reject(new Error(`WebSocket error: ${String(event)}`));
    });
  });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
