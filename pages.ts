/** Sign-in and consent pages for the embedded Better Auth authorization server. */

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 26rem; margin: 4rem auto; padding: 0 1rem; }
      label { display: block; margin-top: .75rem; }
      input { width: 100%; padding: .5rem; box-sizing: border-box; }
      button { margin-top: 1rem; padding: .5rem 1rem; }
      [role=alert] { color: #b00; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    ${body}
  </body>
</html>`;
}

export const signInPage = page(
  "Sign in",
  `
<form id="sign-in">
  <label>Email <input name="email" type="email" autocomplete="username" required></label>
  <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
  <button type="submit">Sign in</button>
</form>
<p id="error" role="alert"></p>
<script>
  const form = document.querySelector('#sign-in');
  const error = document.querySelector('#error');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const data = new FormData(form);
    const response = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: data.get('email'),
        password: data.get('password'),
        oauth_query: window.location.search.slice(1),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.url) {
      window.location.replace(result.url);
      return;
    }
    error.textContent = result.message || 'Sign-in failed';
  });
</script>`,
);

export const consentPage = page(
  "Authorize MCP client",
  `
<p>A client is requesting access to this MCP server.</p>
<button data-accept="false">Deny</button>
<button data-accept="true">Allow</button>
<p id="error" role="alert"></p>
<script>
  document.querySelectorAll('[data-accept]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await fetch('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accept: button.dataset.accept === 'true',
          oauth_query: window.location.search.slice(1),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.url) {
        window.location.href = result.url;
        return;
      }
      document.querySelector('#error').textContent = result.message || 'Authorization failed';
    });
  });
</script>`,
);
