import type {
  HubMessagesResponse,
  HubSendResponse,
  HubStatusResponse,
} from "./types.js";

export class HubClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(hubUrl: string, apiKey: string) {
    this.baseUrl = hubUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const sep = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${sep}key=${encodeURIComponent(this.apiKey)}`;

    const resp = await fetch(fullUrl, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...init?.headers,
      },
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Hub API ${resp.status}: ${body}`);
    }

    return resp.json() as Promise<T>;
  }

  async getMessages(cursor?: string, limit = 50): Promise<HubMessagesResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    params.set("limit", String(limit));
    return this.request<HubMessagesResponse>(
      `/api/channel/messages?${params}`,
    );
  }

  async send(text: string, recipient?: string): Promise<HubSendResponse> {
    return this.request<HubSendResponse>("/api/channel/send", {
      method: "POST",
      body: JSON.stringify({ text, recipient }),
    });
  }

  async getStatus(): Promise<HubStatusResponse> {
    return this.request<HubStatusResponse>("/api/channel/status");
  }

  buildWsUrl(): string {
    const httpUrl = this.baseUrl;
    const wsUrl = httpUrl
      .replace(/^https:/, "wss:")
      .replace(/^http:/, "ws:");
    return `${wsUrl}/api/ws?key=${encodeURIComponent(this.apiKey)}`;
  }
}
