import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { MCPServer } from "mcp-use";
import { oauthBetterAuthProvider } from "mcp-use/oauth/better-auth";
import { z } from "zod";

import { auth, authURL, resource, seedUsers } from "./auth.js";
import { consentPage, signInPage } from "./pages.js";

// An OAuth-protected MCP server for testing Manufact evals with profiles. Every tool returns
// fixed data, so eval results depend only on the model and on who is signed in.

const server = new MCPServer({
  name: "mcp-evals-actions-experiment-4",
  title: "Evals Auth Demo",
  version: "1.0.0",
  description: "Fixed-answer tools behind OAuth, for trying Manufact evals with profiles",
  oauth: oauthBetterAuthProvider({ authURL, resource }),
});

await seedUsers();

// --- The authorization server, on the same origin --------------------------------------------

// The issuer has a path, so serve the RFC 8414 path-aware form and the OIDC form.
const metadataHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};
const authServerMetadata = oauthProviderAuthServerMetadata(auth, { headers: metadataHeaders });
const openIdConfiguration = oauthProviderOpenIdConfigMetadata(auth, { headers: metadataHeaders });
server.app.get("/.well-known/oauth-authorization-server/api/auth", (c) =>
  authServerMetadata(c.req.raw),
);
server.app.get("/api/auth/.well-known/oauth-authorization-server", (c) =>
  authServerMetadata(c.req.raw),
);
server.app.get("/api/auth/.well-known/openid-configuration", (c) =>
  openIdConfiguration(c.req.raw),
);

// A signed-out authorize request is answered with {"redirect":true,"url":"/sign-in?..."} JSON
// (meant for Better Auth's client SDK) even when a browser opens it. Send it as a real redirect.
server.app.get("/api/auth/oauth2/authorize", async (c) => {
  const response = await auth.handler(c.req.raw);
  if (response.status !== 200) return response;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { redirect?: unknown; url?: unknown } | null;
  if (body?.redirect !== true || typeof body.url !== "string") return response;
  const headers = new Headers(response.headers);
  headers.delete("content-type");
  headers.delete("content-length");
  headers.set("location", new URL(body.url, c.req.url).href);
  return new Response(null, { status: 302, headers });
});
server.app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
server.app.get("/sign-in", (c) => c.html(signInPage));
server.app.get("/consent", (c) => c.html(consentPage));

// --- Tools --------------------------------------------------------------------------------------

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** Fixed account data per signed-in test user. */
const ACCOUNTS: Record<string, { plan: string; seats: number; region: string }> = {
  "alice@evals.test": { plan: "Pro", seats: 5, region: "EU" },
  "bob@evals.test": { plan: "Free", seats: 1, region: "US" },
};

server.tool(
  {
    name: "whoami",
    title: "Who am I",
    description:
      "Use when you need to know who is signed in. Returns the signed-in user's email and name. Takes no input and changes nothing.",
    annotations: readOnly,
  },
  async (_params, ctx) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({ email: ctx.auth.user.email, name: ctx.auth.user.name }, null, 2),
      },
    ],
  }),
);

server.tool(
  {
    name: "get_account",
    title: "Get account",
    description:
      "Use to look up the signed-in user's account: plan, number of seats and data region. Takes no input and changes nothing.",
    annotations: readOnly,
  },
  async (_params, ctx) => {
    const email = ctx.auth.user.email ?? "";
    const account = ACCOUNTS[email] ?? { plan: "Unknown", seats: 0, region: "none" };
    return {
      content: [
        {
          type: "text",
          text: `${email}: ${account.plan} plan, ${account.seats} seat(s), region ${account.region}`,
        },
      ],
    };
  },
);

server.tool(
  {
    name: "echo",
    title: "Echo",
    description:
      "Use to check the connection works. Returns the given message unchanged. Changes nothing.",
    schema: z.object({
      message: z.string().min(1).max(1000).describe("Text to send back, up to 1000 characters."),
    }),
    annotations: readOnly,
  },
  async ({ message }) => ({ content: [{ type: "text", text: message }] }),
);

export default server;
