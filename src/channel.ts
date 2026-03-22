import type {
  ChannelAccountSnapshot,
  ChannelPlugin,
} from "openclaw/plugin-sdk";
import {
  listAccountIds,
  resolveAccount,
  defaultAccountId,
  isConfigured,
  isEnabled,
  applyAccountConfig,
  validateInput,
} from "./config.js";
import { OpenILinkConfigSchema } from "./config-schema.js";
import { startGateway } from "./gateway.js";
import { isDuplicate, parseInbound } from "./inbound.js";
import { sendText, sendMedia } from "./outbound.js";
import type { ResolvedAccount } from "./types.js";

export const openiLinkPlugin: ChannelPlugin<ResolvedAccount> = {
  id: "openilink",

  meta: {
    id: "openilink",
    label: "OpenILink",
    selectionLabel: "OpenILink (WeChat via iLink)",
    docsPath: "/channels/openilink",
    docsLabel: "openilink",
    blurb:
      "WeChat messaging via OpenILink Hub. Requires an OpenILink Hub instance with a bound WeChat bot.",
    order: 80,
    aliases: ["ilink", "wechat-ilink"],
  },

  capabilities: {
    text: true,
    image: false, // Hub currently text-only for outbound
    audio: false,
    video: false,
    file: false,
    reaction: false,
    typing: false,
    threads: false,
    mentions: false,
    polls: false,
    richText: false,
    buttons: false,
  },

  configSchema: OpenILinkConfigSchema,

  config: {
    listAccountIds: (cfg) => listAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveAccount(cfg, accountId),
    defaultAccountId: (cfg) => defaultAccountId(cfg),
    isEnabled: (account) => isEnabled(account),
    isConfigured: (account) => isConfigured(account),
    unconfiguredReason: () => "Missing Hub URL or API Key",
    disabledReason: (account) => {
      if (!isConfigured(account)) return "Not configured";
      return "Disabled in config";
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      configured: isConfigured(account),
      enabled: isEnabled(account),
      dmPolicy: account.dmPolicy,
      allowFrom: account.allowFrom,
      baseUrl: account.hubUrl,
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveAccount(cfg, accountId);
      return account.allowFrom;
    },
  },

  setup: {
    applyAccountConfig: (params) =>
      applyAccountConfig({
        cfg: params.cfg,
        accountId: params.accountId,
        input: params.input,
      }),
    validateInput: (params) =>
      validateInput({ input: params.input }),
  },

  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 2000,
    sendText: async (ctx) => {
      const result = await sendText(ctx);
      return {
        ok: result.ok,
        messageId: result.messageId,
        error: result.error ? new Error(result.error) : undefined,
      };
    },
    sendMedia: async (ctx) => {
      const result = await sendMedia(ctx);
      return {
        ok: result.ok,
        messageId: result.messageId,
        error: result.error ? new Error(result.error) : undefined,
      };
    },
  },

  gateway: {
    startAccount: async (ctx) => {
      const { account, abortSignal, setStatus, log } = ctx;

      if (!isConfigured(account)) {
        setStatus({
          accountId: account.accountId,
          configured: false,
          running: false,
        });
        return;
      }

      setStatus({
        accountId: account.accountId,
        configured: true,
        enabled: true,
        running: true,
        lastStartAt: Date.now(),
      });

      await startGateway({
        account,
        abortSignal,
        onMessage: (hubMsg) => {
          // Dedup
          const dedupKey = hubMsg.externalId || String(hubMsg.id);
          if (isDuplicate(dedupKey)) return;

          const envelope = parseInbound(hubMsg);
          if (!envelope) return;

          // Dispatch to OpenClaw via channelRuntime if available
          if (ctx.channelRuntime) {
            ctx.channelRuntime.reply
              .dispatchReplyWithBufferedBlockDispatcher({
                ctx: {
                  senderId: envelope.senderId,
                  senderLabel: envelope.senderLabel,
                  text: envelope.text,
                  messageId: envelope.messageId,
                  timestamp: envelope.timestamp,
                  channelId: "openilink",
                  accountId: account.accountId,
                  isGroup: !!envelope.groupId,
                  groupId: envelope.groupId ?? undefined,
                },
                cfg: ctx.cfg,
                dispatcherOptions: {
                  deliver: async (payload) => {
                    const hubClient = await import("./hub-client.js").then(
                      (m) => new m.HubClient(account.hubUrl, account.apiKey),
                    );
                    await hubClient.send(
                      typeof payload === "string" ? payload : payload.text ?? "",
                      envelope.senderId,
                    );
                  },
                },
              })
              .catch((err: unknown) => {
                log?.error?.(
                  "[openilink] Failed to dispatch inbound:",
                  err,
                );
              });
          }
        },
        onStatus: (botStatus) => {
          const connected = botStatus === "connected" || botStatus === "online";
          setStatus({
            accountId: account.accountId,
            connected,
            lastEventAt: Date.now(),
          } as ChannelAccountSnapshot);
        },
        setStatus: (patch) => {
          setStatus({
            accountId: account.accountId,
            ...patch,
          } as ChannelAccountSnapshot);
        },
        log,
      });
    },
  },

  status: {
    buildAccountSnapshot: async (params) => {
      const { account, runtime } = params;
      return {
        accountId: account.accountId,
        configured: isConfigured(account),
        enabled: isEnabled(account),
        connected: runtime?.connected ?? false,
        running: runtime?.running ?? false,
        dmPolicy: account.dmPolicy,
        baseUrl: account.hubUrl,
        ...runtime,
      };
    },
    probeAccount: async (params) => {
      const { account } = params;
      const { HubClient } = await import("./hub-client.js");
      const client = new HubClient(account.hubUrl, account.apiKey);
      return client.getStatus();
    },
  },
};
