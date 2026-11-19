# mcp-evals-actions-experiment-4

An OAuth-protected MCP server for testing Manufact evals with profiles, run from GitHub Actions
with [`mcp-use/evals`](https://github.com/mcp-use/evals).

The server carries its own authorization server: Better Auth with the OAuth 2.1 provider plugin,
mounted on the same origin (`/api/auth`, `/sign-in`, `/consent`). Its store is in memory, so a
restart forgets clients, refresh tokens and signing keys, and every connected profile needs a
reconnect. Access tokens last a week.

## Tools

All return fixed data:

- `whoami`: the signed-in user's email and name.
- `get_account`: the signed-in user's plan: `alice@evals.test` is Pro with 5 seats in the EU,
  `bob@evals.test` is Free with 1 seat in the US.
- `echo(message)`: the message, unchanged.

## Environment

| Variable | Value |
|---|---|
| `PUBLIC_URL` | The server's public origin (its Manufact gateway URL) |
| `BETTER_AUTH_SECRET` | 32+ random characters |
| `TEST_USERS` | `email:password:name` entries separated by commas |

## Evals

Suites live in `evals/`. `.github/workflows/evals.yml` runs them on demand (**Actions > Evals >
Run workflow**), optionally with a `profile` to sign in as a different account than the server's
own profile.
