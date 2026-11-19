import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { jwt } from "better-auth/plugins";

/**
 * A Better Auth authorization server that lives inside this MCP server, on the same origin, so
 * the server is self-contained: no shared auth project to configure. State is in memory: a
 * restart forgets clients, refresh tokens and signing keys, and every profile then needs a
 * reconnect. Access tokens last a week so a connected profile survives without refreshes.
 */

const env: Record<string, string | undefined> = process.env;

/** `mcp-use build` evaluates this module to inspect the server; it serves no requests. */
const building = env["MCP_USE_PHASE"] === "build";

function secret(): string {
  const value = env["BETTER_AUTH_SECRET"];
  if (value) return value;
  if (building) return "build-only-placeholder-secret-never-serves-requests";
  throw new Error("BETTER_AUTH_SECRET is required");
}

/** Public origin of this server (the Manufact gateway URL), e.g. https://<slug>.run.mcp-use.com */
export const publicOrigin = new URL(env["PUBLIC_URL"] ?? "http://localhost:3000").origin;
/** The MCP resource tokens are issued for. */
export const resource = `${publicOrigin}/mcp`;
/** Issuer, with Better Auth's base path. */
export const authURL = `${publicOrigin}/api/auth`;

const tables = [
  "user",
  "session",
  "account",
  "verification",
  "jwks",
  "oauthClient",
  "oauthRefreshToken",
  "oauthAccessToken",
  "oauthConsent",
  "oauthResource",
  "oauthClientResource",
  "oauthClientAssertion",
  "rateLimit",
];
const memory: Record<string, Record<string, unknown>[]> = Object.fromEntries(
  tables.map((table) => [table, []]),
);

export const auth = betterAuth({
  baseURL: publicOrigin,
  basePath: "/api/auth",
  secret: secret(),
  database: memoryAdapter(memory),
  // A devspace's local gateway (wrangler dev) hands requests on with an http:// origin.
  trustedOrigins: [publicOrigin, publicOrigin.replace(/^https:/, "http:")],
  rateLimit: { enabled: false },
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      resources: [resource],
      clientRegistrationDefaultResources: [resource],
      accessTokenExpiresIn: 7 * 24 * 60 * 60,
      customAccessTokenClaims: ({ user }) => ({ email: user?.email, name: user?.name }),
      silenceWarnings: { oauthAuthServerConfig: true },
    }),
  ],
});

/** The two test accounts, from TEST_USERS: `email:password:name` entries separated by commas. */
function testUsers(): { email: string; password: string; name: string }[] {
  return (env["TEST_USERS"] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email = "", password = "", name = email] = entry.split(":");
      return { email, password, name };
    });
}

/** Create the test accounts in the in-memory store. */
export async function seedUsers(): Promise<void> {
  if (building) return;
  const ctx = await auth.$context;
  for (const user of testUsers()) {
    if (await ctx.internalAdapter.findUserByEmail(user.email)) continue;
    const created = await ctx.internalAdapter.createUser(
      { email: user.email, name: user.name, emailVerified: true },
      { method: "email-password" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await ctx.password.hash(user.password),
    });
    console.log(`seeded ${user.email}`);
  }
}
