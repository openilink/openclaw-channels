import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { ResolvedAccount } from "./types.js";

const CHANNEL_KEY = "channels.openilink" as const;

type RawAccountConfig = {
  hubUrl?: string;
  apiKey?: string;
  botId?: string;
  enabled?: boolean;
  dmPolicy?: string;
  allowFrom?: string[];
};

function getRawAccounts(cfg: OpenClawConfig): Record<string, RawAccountConfig> {
  const section = (cfg as Record<string, unknown>)[CHANNEL_KEY];
  if (!section || typeof section !== "object") return {};
  return section as Record<string, RawAccountConfig>;
}

function getRawAccount(cfg: OpenClawConfig, accountId: string): RawAccountConfig {
  const accounts = getRawAccounts(cfg);
  // If the section is a flat config (not keyed by account), treat it as the default account
  if (accounts.hubUrl && typeof accounts.hubUrl === "string") {
    return accountId === "default" ? (accounts as unknown as RawAccountConfig) : {};
  }
  return accounts[accountId] ?? {};
}

export function listAccountIds(cfg: OpenClawConfig): string[] {
  const section = getRawAccounts(cfg);
  if (!section || typeof section !== "object") return [];
  // Flat config → single "default" account
  if (typeof (section as RawAccountConfig).hubUrl === "string") {
    return ["default"];
  }
  return Object.keys(section);
}

export function resolveAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedAccount {
  const id = accountId ?? defaultAccountId(cfg);
  const raw = getRawAccount(cfg, id);
  return {
    accountId: id,
    hubUrl: (raw.hubUrl ?? "").replace(/\/+$/, ""),
    apiKey: raw.apiKey ?? "",
    botId: raw.botId ?? "",
    enabled: raw.enabled !== false,
    dmPolicy: raw.dmPolicy ?? "pairing",
    allowFrom: raw.allowFrom ?? [],
  };
}

export function defaultAccountId(cfg: OpenClawConfig): string {
  const ids = listAccountIds(cfg);
  return ids[0] ?? "default";
}

export function isConfigured(account: ResolvedAccount): boolean {
  return !!(account.hubUrl && account.apiKey);
}

export function isEnabled(account: ResolvedAccount): boolean {
  return account.enabled && isConfigured(account);
}

export function applyAccountConfig(params: {
  cfg: OpenClawConfig;
  accountId: string;
  input: { httpUrl?: string; token?: string; name?: string };
}): OpenClawConfig {
  const { cfg, accountId, input } = params;
  const next = { ...cfg } as Record<string, unknown>;
  const section = { ...(getRawAccounts(cfg) as Record<string, unknown>) };

  const account: RawAccountConfig = {
    ...getRawAccount(cfg, accountId),
    enabled: true,
  };
  if (input.httpUrl) account.hubUrl = input.httpUrl;
  if (input.token) account.apiKey = input.token;

  section[accountId] = account;
  next[CHANNEL_KEY] = section;
  return next as OpenClawConfig;
}

export function validateInput(params: {
  input: { httpUrl?: string; token?: string };
}): string | null {
  if (!params.input.httpUrl) return "Hub URL is required";
  if (!params.input.token) return "API Key is required";
  try {
    new URL(params.input.httpUrl);
  } catch {
    return "Hub URL must be a valid URL";
  }
  return null;
}
