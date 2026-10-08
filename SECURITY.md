# Public viewing security model

This application is a public, read-only projection of GZCTF data. It must not
act as a transparent GZCTF proxy and must never receive or reuse an administrator
session.

## Public API allowlist

Only these GET endpoints are implemented:

- `/api/public/games`
- `/api/public/games/:gameId/snapshot`
- `/api/public/posters/:assetId`

All other `/api/*` paths fail closed with `404`, including login, challenge
details, raw events, containers, submissions, account, team, and admin paths.
The snapshot endpoint reads only the unauthenticated GZCTF game list and public
scoreboard endpoints. Incoming request headers and cookies are never forwarded.

Responses are rebuilt from an explicit field allowlist. Unknown upstream fields
are discarded recursively. In particular, the public model excludes:

- submitted flags and raw event value arrays;
- failed submissions, container lifecycle events, and cheat events;
- challenge content, hints, attachments, and dynamic flag configuration;
- participant usernames, team biographies, avatars, and blood records;
- authentication cookies, tokens, passwords, and upstream response headers.

The activity feed is synthesized only from successful solves already present in
the public scoreboard.

This boundary is field-based, not a content-classification system. Do not place
secrets in intentionally public fields such as game titles, game summaries,
challenge titles, or team names. Review those fields before publishing a game.

## Deployment requirements

1. Bind GZCTF to loopback or a private network. For Docker Compose, prefer:

   ```yaml
   ports:
     - "127.0.0.1:36306:8080"
   ```

2. Expose only the viewing application through the public reverse proxy. Set:

   ```bash
   GZCTF_API_ORIGIN=http://127.0.0.1:36306
   ```

3. Do not set administrator credentials, tokens, or cookies in this application.
4. Terminate TLS at Nginx, Caddy, or another trusted reverse proxy.
5. Apply network-level rate limits to `/api/public/*` and keep GZCTF management
   routes inaccessible from the Internet.

## Release checks

Before deployment, run:

```bash
pnpm check
pnpm build
```

After deployment, verify the deny-by-default boundary:

```bash
curl -i http://viewer.example/api/account/login
curl -i http://viewer.example/api/game/1/details
curl -i http://viewer.example/api/game/1/events
```

Each request must return `404`. Inspect a public snapshot and confirm it contains
none of the excluded fields above.

## Reporting a vulnerability

Do not include flags, credentials, tokens, or private event payloads in a public
issue. Contact the repository owner privately and rotate any exposed credential
before sharing diagnostic material.
