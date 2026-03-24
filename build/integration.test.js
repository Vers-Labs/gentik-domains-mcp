/**
 * Integration tests that hit the live AgentDomains API.
 * Only tests unauthenticated endpoints to avoid side effects.
 *
 * Run with: npm test -- --reporter=verbose src/integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { registerTools } from "./tools.js";
describe("Integration: live API", () => {
    let client;
    let server;
    beforeAll(async () => {
        // Use production API — no API key (only unauthenticated tools)
        delete process.env.GENTIK_API_KEY;
        process.env.GENTIK_API_URL = "https://agentdomains.dev";
        server = new McpServer({ name: "integration-test", version: "0.0.1" });
        registerTools(server);
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        client = new Client({ name: "test-client", version: "0.0.1" });
        await server.connect(serverTransport);
        await client.connect(clientTransport);
    });
    afterAll(async () => {
        await client.close();
        await server.close();
    });
    it("check_domain: example.com is taken", async () => {
        const result = await client.callTool({
            name: "check_domain",
            arguments: { domain: "example.com" },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.domain).toBe("example.com");
        expect(data.available).toBe(false);
        expect(data.status).toBe("taken");
        expect(data.pricing.registration).toBeGreaterThan(0);
        expect(data.pricing.currency).toBe("USD");
    }, 15000);
    it("check_domain: random domain with unusual TLD is likely available", async () => {
        const random = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const result = await client.callTool({
            name: "check_domain",
            arguments: { domain: `${random}.click` },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.domain).toBe(`${random}.click`);
        expect(data.available).toBe(true);
        expect(data.status).toBe("available");
    }, 15000);
    it("check_domains_bulk: checks multiple domains at once", async () => {
        const result = await client.callTool({
            name: "check_domains_bulk",
            arguments: { domains: ["google.com", "example.org"] },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.count).toBe(2);
        expect(data.results).toHaveLength(2);
        // Both should be taken
        expect(data.results.every((r) => !r.available)).toBe(true);
    }, 15000);
    it("list_tlds: returns supported TLDs with pricing", async () => {
        const result = await client.callTool({
            name: "list_tlds",
            arguments: {},
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.count).toBeGreaterThan(0);
        expect(data.tlds.length).toBeGreaterThan(0);
        // Each TLD should have expected fields
        const tld = data.tlds[0];
        expect(tld.tld).toBeDefined();
        expect(tld.registration).toBeGreaterThan(0);
        expect(tld.renewal).toBeGreaterThan(0);
        expect(tld.currency).toBe("USD");
    }, 15000);
    it("challenge: can request auth challenge with a test key", async () => {
        // Use a dummy Ed25519 hex key (64 chars)
        const testHexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const result = await client.callTool({
            name: "challenge",
            arguments: { publicKey: testHexKey },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.challengeId).toBeDefined();
        expect(data.challenge).toBeDefined();
        expect(data.expiresAt).toBeDefined();
    }, 15000);
    it("authenticated tools fail gracefully without API key", async () => {
        const result = await client.callTool({
            name: "list_domains",
            arguments: {},
        });
        expect(result.isError).toBe(true);
        const text = result.content[0]
            .text;
        expect(text).toContain("GENTIK_API_KEY is required");
    });
});
//# sourceMappingURL=integration.test.js.map