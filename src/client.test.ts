import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GentikClient } from "./client.js";

describe("GentikClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GENTIK_API_URL = "https://test.example.com";
    process.env.GENTIK_API_KEY = "gtk_test_key_123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses GENTIK_API_URL from environment", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new GentikClient();
    await client.get("/api/test");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://test.example.com/api/test",
      expect.any(Object)
    );
  });

  it("defaults to agentdomains.dev when no URL set", async () => {
    delete process.env.GENTIK_API_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new GentikClient();
    await client.get("/api/test");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://agentdomains.dev/api/test",
      expect.any(Object)
    );
  });

  it("strips trailing slashes from base URL", async () => {
    process.env.GENTIK_API_URL = "https://test.example.com///";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new GentikClient();
    await client.get("/api/test");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://test.example.com/api/test",
      expect.any(Object)
    );
  });

  it("sends Authorization header for authenticated requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new GentikClient();
    await client.get("/api/account", true);
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer gtk_test_key_123");
  });

  it("omits Authorization header for unauthenticated requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new GentikClient();
    await client.get("/api/domains/tlds", false);
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("throws when auth required but no API key set", async () => {
    delete process.env.GENTIK_API_KEY;
    const client = new GentikClient();
    await expect(client.get("/api/account", true)).rejects.toThrow(
      "GENTIK_API_KEY is required"
    );
  });

  it("sends User-Agent header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new GentikClient();
    await client.get("/api/test");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("gentik-domains-mcp/0.1.0");
  });

  it("POST sends JSON body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const client = new GentikClient();
    await client.post("/api/auth/challenge", { publicKey: "abc123" });
    const opts = fetchSpy.mock.calls[0][1];
    expect(opts?.method).toBe("POST");
    expect(opts?.body).toBe(JSON.stringify({ publicKey: "abc123" }));
  });

  it("parses JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ domain: "test.com", available: true }), {
        status: 200,
      })
    );
    const client = new GentikClient();
    const result = await client.get("/api/domains/check?domain=test.com");
    expect(result).toEqual({ domain: "test.com", available: true });
  });

  it("throws on API error with error+hint fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          hint: "Try again in 60 seconds",
        }),
        { status: 429 }
      )
    );
    const client = new GentikClient();
    await expect(client.get("/api/test")).rejects.toThrow(
      "Rate limit exceeded (hint: Try again in 60 seconds)"
    );
  });

  it("throws on API error with details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Validation failed",
          details: { domain: "required" },
        }),
        { status: 400 }
      )
    );
    const client = new GentikClient();
    await expect(client.get("/api/test")).rejects.toThrow(
      'Validation failed\nDetails: {"domain":"required"}'
    );
  });

  it("throws with raw HTTP status for non-JSON errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );
    const client = new GentikClient();
    await expect(client.get("/api/test")).rejects.toThrow(
      "HTTP 500: Internal Server Error"
    );
  });

  it("handles non-JSON success response gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 })
    );
    const client = new GentikClient();
    const result = await client.get("/api/health");
    expect(result).toEqual({ rawResponse: "OK" });
  });
});
