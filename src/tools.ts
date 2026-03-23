import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GentikClient } from "./client.js";

type ToolRegistrar = McpServer;

export function registerTools(server: ToolRegistrar): void {
  const client = new GentikClient();

  // ── Auth: Challenge ──────────────────────────────────────────────
  server.tool(
    "challenge",
    "Request an authentication challenge. Provide your Ed25519 public key (SSH, hex, or base58 format). Returns a challenge string to sign.",
    {
      publicKey: z
        .string()
        .describe(
          "Ed25519 public key in SSH (ssh-ed25519 AAAA...), hex (64 chars), or base58 (Solana) format"
        ),
    },
    async ({ publicKey }) => {
      const data = await client.post("/api/auth/challenge", { publicKey });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── Auth: Verify ─────────────────────────────────────────────────
  server.tool(
    "verify",
    "Verify a signed challenge to authenticate and receive an API key. The API key is shown only once — save it immediately.",
    {
      challengeId: z
        .string()
        .describe("Challenge ID returned from the challenge tool"),
      signature: z
        .string()
        .describe(
          "Signature of the challenge string (SSH SSHSIG, hex, or base64 format)"
        ),
    },
    async ({ challengeId, signature }) => {
      const data = await client.post("/api/auth/verify", {
        challengeId,
        signature,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── Check Domain ─────────────────────────────────────────────────
  server.tool(
    "check_domain",
    "Check if a single domain is available for registration and get pricing. No authentication required.",
    {
      domain: z.string().describe("Domain name to check (e.g. example.com)"),
    },
    async ({ domain }) => {
      const data = await client.get(
        `/api/domains/check?domain=${encodeURIComponent(domain)}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── Check Domains Bulk ───────────────────────────────────────────
  server.tool(
    "check_domains_bulk",
    "Check availability and pricing for up to 50 domains at once. No authentication required.",
    {
      domains: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("Array of domain names to check (1–50)"),
    },
    async ({ domains }) => {
      const data = await client.post("/api/domains/check/bulk", { domains });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── Register Domain ──────────────────────────────────────────────
  server.tool(
    "register_domain",
    "Register a domain. Returns a payment URL (for invoice method) or confirms registration (for credits). Requires GENTIK_API_KEY.",
    {
      domain: z.string().describe("Domain name to register"),
      period: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Registration period in years (default: 1)"),
      paymentMethod: z
        .enum(["invoice", "credits"])
        .optional()
        .describe("Payment method: 'invoice' (Stripe link) or 'credits' (default: invoice)"),
      autoRenew: z
        .boolean()
        .optional()
        .describe("Enable auto-renewal (default: true)"),
      registrant: z
        .object({
          firstName: z.string(),
          lastName: z.string(),
          organization: z.string().optional(),
          email: z.string().email(),
          phone: z.string().describe("E.164 format, e.g. +1.5551234567"),
          address: z.object({
            street: z.string(),
            city: z.string(),
            state: z.string(),
            postalCode: z.string(),
            country: z
              .string()
              .describe("ISO 3166-1 alpha-2 country code (e.g. US)"),
          }),
        })
        .optional()
        .describe("Registrant contact info (required for most TLDs)"),
    },
    async ({ domain, period, paymentMethod, autoRenew, registrant }) => {
      const body: Record<string, unknown> = { domain };
      if (period !== undefined) body.period = period;
      if (paymentMethod !== undefined) body.paymentMethod = paymentMethod;
      if (autoRenew !== undefined) body.autoRenew = autoRenew;
      if (registrant !== undefined) body.registrant = registrant;

      const data = await client.post("/api/domains/register", body, true);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── List Domains ─────────────────────────────────────────────────
  server.tool(
    "list_domains",
    "List all domains registered to your account. Requires GENTIK_API_KEY.",
    {},
    async () => {
      const data = await client.get("/api/domains", true);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── Get Account ──────────────────────────────────────────────────
  server.tool(
    "get_account",
    "Get account info including credit balance, domain count, and expiring domains. Requires GENTIK_API_KEY.",
    {},
    async () => {
      const data = await client.get("/api/account", true);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── Add DNS Record ───────────────────────────────────────────────
  server.tool(
    "add_dns_record",
    "Add a DNS record to a domain. Supports A, AAAA, CNAME, TXT, MX, NS, SRV, and CAA record types. Requires GENTIK_API_KEY.",
    {
      domain: z.string().describe("Domain name (e.g. example.com)"),
      type: z
        .enum(["A", "AAAA", "CNAME", "TXT", "MX", "NS", "SRV", "CAA"])
        .describe("DNS record type"),
      name: z
        .string()
        .optional()
        .describe("Subdomain or @ for root (default: @)"),
      content: z.string().describe("Record value (IP address, hostname, text, etc.)"),
      priority: z
        .number()
        .int()
        .optional()
        .describe("Priority (required for MX and SRV records)"),
      weight: z
        .number()
        .int()
        .optional()
        .describe("Weight (for SRV records)"),
      port: z
        .number()
        .int()
        .optional()
        .describe("Port (for SRV records)"),
    },
    async ({ domain, type, name, content, priority, weight, port }) => {
      const body: Record<string, unknown> = { type, content };
      if (name !== undefined) body.name = name;
      if (priority !== undefined) body.priority = priority;
      if (weight !== undefined) body.weight = weight;
      if (port !== undefined) body.port = port;

      const data = await client.post(
        `/api/domains/${encodeURIComponent(domain)}/dns`,
        body,
        true
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── List DNS Records ─────────────────────────────────────────────
  server.tool(
    "list_dns_records",
    "List all DNS records for a domain. Requires GENTIK_API_KEY.",
    {
      domain: z.string().describe("Domain name (e.g. example.com)"),
    },
    async ({ domain }) => {
      const data = await client.get(
        `/api/domains/${encodeURIComponent(domain)}/dns`,
        true
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  // ── List TLDs ────────────────────────────────────────────────────
  server.tool(
    "list_tlds",
    "List all supported top-level domains (TLDs) with registration and renewal pricing. No authentication required.",
    {},
    async () => {
      const data = await client.get("/api/domains/tlds");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
