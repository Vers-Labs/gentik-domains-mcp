/**
 * Lightweight HTTP client for the AgentDomains API.
 */
const DEFAULT_BASE_URL = "https://agentdomains.dev";
export class GentikClient {
    baseUrl;
    apiKey;
    constructor() {
        this.baseUrl = (process.env.GENTIK_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.apiKey = process.env.GENTIK_API_KEY;
    }
    headers(auth) {
        const h = {
            "Content-Type": "application/json",
            "User-Agent": "gentik-domains-mcp/0.1.0",
        };
        if (auth) {
            if (!this.apiKey) {
                throw new Error("GENTIK_API_KEY is required for this operation. " +
                    "Use the challenge and verify tools to authenticate first, " +
                    "then set GENTIK_API_KEY in your environment.");
            }
            h["Authorization"] = `Bearer ${this.apiKey}`;
        }
        return h;
    }
    async get(path, auth = false) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: "GET",
            headers: this.headers(auth),
        });
        return this.handleResponse(res);
    }
    async post(path, body, auth = false) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: "POST",
            headers: this.headers(auth),
            body: JSON.stringify(body),
        });
        return this.handleResponse(res);
    }
    async handleResponse(res) {
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = { rawResponse: text };
        }
        if (!res.ok) {
            const err = data;
            throw new Error(err?.error
                ? String(err.error) +
                    (err.hint ? ` (hint: ${err.hint})` : "") +
                    (err.details ? `\nDetails: ${JSON.stringify(err.details)}` : "")
                : `HTTP ${res.status}: ${text}`);
        }
        return data;
    }
}
//# sourceMappingURL=client.js.map