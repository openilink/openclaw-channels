import type { ChannelConfigSchema } from "openclaw/plugin-sdk";

export const OpenILinkConfigSchema: ChannelConfigSchema = {
  schema: {
    type: "object",
    properties: {
      hubUrl: {
        type: "string",
        description: "OpenILink Hub URL (e.g. https://hub.openilink.com)",
      },
      apiKey: {
        type: "string",
        description: "Channel API key from Hub dashboard",
      },
      botId: {
        type: "string",
        description: "Bot ID (optional, auto-detected from channel)",
      },
      enabled: {
        type: "boolean",
        description: "Enable or disable this account",
        default: true,
      },
      dmPolicy: {
        type: "string",
        enum: ["pairing", "allowlist", "open"],
        description: "Direct message access policy",
        default: "pairing",
      },
      allowFrom: {
        type: "array",
        items: { type: "string" },
        description: "Allowed sender IDs (used with allowlist policy)",
      },
    },
    required: ["hubUrl", "apiKey"],
  },
  uiHints: {
    hubUrl: {
      label: "Hub URL",
      help: "The URL of your OpenILink Hub instance",
      placeholder: "https://hub.openilink.com",
    },
    apiKey: {
      label: "API Key",
      help: "Channel API key from Hub → Channels → your channel",
      sensitive: true,
    },
    botId: {
      label: "Bot ID",
      help: "Usually auto-detected. Set manually if you have multiple bots.",
      advanced: true,
    },
    dmPolicy: {
      label: "DM Policy",
      help: "Controls who can message your bot directly",
    },
    allowFrom: {
      label: "Allowed Senders",
      help: "WeChat user IDs allowed to message (allowlist policy only)",
      advanced: true,
    },
  },
};
