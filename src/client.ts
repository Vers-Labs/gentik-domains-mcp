/**
 * Lightweight HTTP client for the AgentDomains API.
 */

const DEFAULT_BASE_URL = "https://agentdomains.dev";

export class GentikClient {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor() {
    this.baseUrl = (
      process.env.GENTIK_API_URL ?? DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.apiKey = process.env.GENTIK_API_KEY;
  }

  private headers(auth: boolean): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "gentik-domains-mcp/0.1.0",
    };
    if (auth) {
      if (!this.apiKey) {
        throw new Error(
          "GENTIK_API_KEY is required for this operation. " +
            "Use the challenge and verify tools to authenticate first, " +
            "then set GENTIK_API_KEY in your environment."
        );
      }
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  async get(path: string, auth = false): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(auth),
    });
    return this.handleResponse(res);
  }

  async post(path: string, body: unknown, auth = false): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(auth),
      body: JSON.stringify(body),
    });
    return this.handleResponse(res);
  }

  private async handleResponse(res: Response): Promise<unknown> {
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text };
    }

    if (!res.ok) {
      const err = data as Record<string, unknown>;
      throw new Error(
        err?.error
          ? String(err.error) +
              (err.hint ? ` (hint: ${err.hint})` : "") +
              (err.details ? `\nDetails: ${JSON.stringify(err.details)}` : "")
          : `HTTP ${res.status}: ${text}`
      );
    }

    return data;
  }
}
