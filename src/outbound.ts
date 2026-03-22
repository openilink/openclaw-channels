import type { ChannelOutboundContext } from "openclaw/plugin-sdk";
import { HubClient } from "./hub-client.js";
import { resolveAccount } from "./config.js";

export type OutboundResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function sendText(ctx: ChannelOutboundContext): Promise<OutboundResult> {
  const account = resolveAccount(ctx.cfg, ctx.accountId);
  if (!account.hubUrl || !account.apiKey) {
    return { ok: false, error: "Account not configured" };
  }

  const client = new HubClient(account.hubUrl, account.apiKey);
  const recipient = ctx.to || "";

  try {
    const resp = await client.send(ctx.text, recipient);
    return {
      ok: resp.ok,
      messageId: resp.client_id,
      error: resp.error,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sendMedia(ctx: ChannelOutboundContext & { mediaUrl: string }): Promise<OutboundResult> {
  // Hub currently only supports text; send media URL as text fallback
  const text = ctx.text
    ? `${ctx.text}\n${ctx.mediaUrl}`
    : ctx.mediaUrl;

  return sendText({ ...ctx, text });
}
