import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { registerTools } from "./tools.js";

// Mock API responses keyed by URL pattern
const mockResponses: Record<string, { status: number; body: unknown }> = {};

function mockApi(urlPattern: string, status: number, body: unknown) {
  mockResponses[urlPattern] = { status, body };
}

function findMock(url: string): { status: number; body: unknown } | undefined {
  for (const [pattern, mock] of Object.entries(mockResponses)) {
    if (url.includes(pattern)) return mock;
  }
  return undefined;
}

describe("MCP Tools", () => {
  let client: Client;
  let server: McpServer;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.GENTIK_API_URL = "https://test.agentdomains.dev";
    process.env.GENTIK_API_KEY = "gtk_test_key";

    // Clear mocks
    for (const key of Object.keys(mockResponses)) delete mockResponses[key];

    // Mock fetch globally
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      const mock = findMock(url);
      if (!mock) {
        return new Response(JSON.stringify({ error: "Not mocked: " + url }), {
          status: 500,
        });
      }
      return new Response(JSON.stringify(mock.body), { status: mock.status });
    });

    // Set up MCP server + in-memory client
    server = new McpServer({ name: "test", version: "0.0.1" });
    registerTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.1" });

    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("lists all 10 tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "add_dns_record",
      "challenge",
      "check_domain",
      "check_domains_bulk",
      "get_account",
      "list_dns_records",
      "list_domains",
      "list_tlds",
      "register_domain",
      "verify",
    ]);
  });

  // ── challenge ──
  it("challenge: sends publicKey and returns response", async () => {
    mockApi("/api/auth/challenge", 200, {
      challengeId: "ch_123",
      challenge: "sign-this-string",
      expiresAt: "2026-03-25T00:00:00Z",
    });

    const result = await client.callTool({
      name: "challenge",
      arguments: { publicKey: "ssh-ed25519 AAAA..." },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const data = JSON.parse(text);
    expect(data.challengeId).toBe("ch_123");
    expect(data.challenge).toBe("sign-this-string");
  });

  // ── verify ──
  it("verify: sends challengeId + signature", async () => {
    mockApi("/api/auth/verify", 200, {
      status: "authenticated",
      agentId: "agent_456",
      apiKey: "gtk_new_key",
    });

    const result = await client.callTool({
      name: "verify",
      arguments: { challengeId: "ch_123", signature: "deadbeef" },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const data = JSON.parse(text);
    expect(data.status).toBe("authenticated");
    expect(data.apiKey).toBe("gtk_new_key");
  });

  // ── check_domain ──
  it("check_domain: checks domain availability", async () => {
    mockApi("/api/domains/check", 200, {
      domain: "cool-agent.com",
      available: true,
      status: "available",
      pricing: { registration: 2250, renewal: 2250, currency: "USD", unit: "cents" },
    });

    const result = await client.callTool({
      name: "check_domain",
      arguments: { domain: "cool-agent.com" },
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.available).toBe(true);
    expect(data.pricing.registration).toBe(2250);
  });

  // ── check_domains_bulk ──
  it("check_domains_bulk: checks multiple domains", async () => {
    mockApi("/api/domains/check/bulk", 200, {
      results: [
        { domain: "a.com", available: false, status: "taken" },
        { domain: "b.dev", available: true, status: "available" },
      ],
      count: 2,
      available: 1,
    });

    const result = await client.callTool({
      name: "check_domains_bulk",
      arguments: { domains: ["a.com", "b.dev"] },
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.count).toBe(2);
    expect(data.available).toBe(1);
  });

  // ── register_domain ──
  it("register_domain: registers with invoice payment", async () => {
    mockApi("/api/domains/register", 201, {
      message: "Invoice created.",
      paymentUrl: "https://pay.stripe.com/abc",
      invoice: { id: "inv_1", amount: 2250, status: "PENDING" },
      domain: "my-agent.com",
    });

    const result = await client.callTool({
      name: "register_domain",
      arguments: { domain: "my-agent.com" },
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.paymentUrl).toBe("https://pay.stripe.com/abc");
    expect(data.domain).toBe("my-agent.com");

    // Verify fetch was called with auth header
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const registerCall = calls.find((c) =>
      (c[0] as string).includes("/api/domains/register")
    );
    expect(registerCall).toBeDefined();
    const headers = registerCall![1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer gtk_test_key");
  });

  it("register_domain: includes optional fields when provided", async () => {
    mockApi("/api/domains/register", 201, { message: "OK", domain: "test.dev" });

    await client.callTool({
      name: "register_domain",
      arguments: {
        domain: "test.dev",
        period: 2,
        paymentMethod: "credits",
        autoRenew: false,
        registrant: {
          firstName: "Agent",
          lastName: "Smith",
          email: "agent@test.dev",
          phone: "+1.5551234567",
          address: {
            street: "123 AI St",
            city: "San Francisco",
            state: "CA",
            postalCode: "94107",
            country: "US",
          },
        },
      },
    });

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const registerCall = calls.find((c) =>
      (c[0] as string).includes("/api/domains/register")
    );
    const body = JSON.parse(registerCall![1]?.body as string);
    expect(body.period).toBe(2);
    expect(body.paymentMethod).toBe("credits");
    expect(body.autoRenew).toBe(false);
    expect(body.registrant.firstName).toBe("Agent");
  });

  // ── list_domains ──
  it("list_domains: returns domain list", async () => {
    mockApi("/api/domains", 200, {
      domains: [
        { id: "d1", domain: "agent1.com", status: "ACTIVE" },
        { id: "d2", domain: "agent2.dev", status: "ACTIVE" },
      ],
      total: 2,
    });

    const result = await client.callTool({
      name: "list_domains",
      arguments: {},
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.total).toBe(2);
    expect(data.domains).toHaveLength(2);
  });

  // ── get_account ──
  it("get_account: returns account info", async () => {
    mockApi("/api/account", 200, {
      id: "agent_1",
      fingerprint: "SHA256:abc",
      domainCount: 3,
      creditBalance: 5000,
      creditBalanceFormatted: "$50.00",
    });

    const result = await client.callTool({
      name: "get_account",
      arguments: {},
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.domainCount).toBe(3);
    expect(data.creditBalance).toBe(5000);
  });

  // ── add_dns_record ──
  it("add_dns_record: adds A record", async () => {
    mockApi("/dns", 201, {
      success: true,
      message: "DNS record created",
      record: { id: "r1", type: "A", name: "@", content: "1.2.3.4" },
    });

    const result = await client.callTool({
      name: "add_dns_record",
      arguments: {
        domain: "test.com",
        type: "A",
        content: "1.2.3.4",
      },
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.success).toBe(true);
    expect(data.record.type).toBe("A");

    // Verify URL contains the domain
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const dnsCall = calls.find((c) => (c[0] as string).includes("/dns"));
    expect(dnsCall![0]).toContain("/api/domains/test.com/dns");
  });

  it("add_dns_record: includes optional MX fields", async () => {
    mockApi("/dns", 201, { success: true, record: { type: "MX" } });

    await client.callTool({
      name: "add_dns_record",
      arguments: {
        domain: "test.com",
        type: "MX",
        name: "mail",
        content: "mx.test.com",
        priority: 10,
      },
    });

    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const dnsCall = calls.find((c) => (c[0] as string).includes("/dns"));
    const body = JSON.parse(dnsCall![1]?.body as string);
    expect(body.type).toBe("MX");
    expect(body.name).toBe("mail");
    expect(body.priority).toBe(10);
  });

  // ── list_dns_records ──
  it("list_dns_records: returns DNS records", async () => {
    mockApi("/dns", 200, {
      domain: "test.com",
      dnsProvider: "cloudflare",
      records: [
        { id: "r1", type: "A", name: "@", content: "1.2.3.4", ttl: 300 },
      ],
      recordCount: 1,
    });

    const result = await client.callTool({
      name: "list_dns_records",
      arguments: { domain: "test.com" },
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.dnsProvider).toBe("cloudflare");
    expect(data.recordCount).toBe(1);
  });

  // ── list_tlds ──
  it("list_tlds: returns TLD list without auth", async () => {
    mockApi("/api/domains/tlds", 200, {
      tlds: [
        { tld: "com", registration: 2250, renewal: 2250 },
        { tld: "dev", registration: 3100, renewal: 3100 },
      ],
      count: 2,
    });

    const result = await client.callTool({
      name: "list_tlds",
      arguments: {},
    });

    const data = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(data.count).toBe(2);

    // Verify no auth header was sent
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    const tldsCall = calls.find((c) =>
      (c[0] as string).includes("/api/domains/tlds")
    );
    const headers = tldsCall![1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  // ── Error handling ──
  it("returns error content when API returns error", async () => {
    mockApi("/api/domains/check", 429, {
      error: "Rate limit exceeded",
      hint: "Try again in 60s",
    });

    const result = await client.callTool({
      name: "check_domain",
      arguments: { domain: "test.com" },
    });

    // MCP SDK wraps tool errors as isError content
    expect(result.isError).toBe(true);
  });

  it("returns error when auth required but no key set", async () => {
    delete process.env.GENTIK_API_KEY;

    // Need a fresh server with no key
    await client.close();
    await server.close();

    server = new McpServer({ name: "test", version: "0.0.1" });
    registerTools(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.1" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: "list_domains",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("GENTIK_API_KEY is required");
  });
});
