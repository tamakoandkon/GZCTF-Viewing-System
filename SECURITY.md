# Public viewing security model

This application is an authenticated, read-only projection of GZCTF data. It
must not act as a transparent GZCTF proxy and must never receive or reuse an
administrator session.

## Authentication and one-seat policy

Players sign in with their own GZCTF account. The viewer sends credentials only
to the exact GZCTF login endpoint, captures the issued GZCTF cookie server-side,
and uses it only for the exact profile, team, game-participation, and logout
endpoints. The GZCTF cookie is never returned to the browser.

The browser receives a separate random viewer cookie with `HttpOnly`,
`SameSite=Strict`, and `Secure` in production. Login and logout require a
same-origin request. Login attempts are rate-limited by account and reverse
proxy client address.

One active viewer session is leased per GZCTF team. The lease is refreshed by
normal viewer traffic and expires after about 90 seconds without activity.
Snapshot requests are limited to one per viewer session every 10 seconds, even
when the client switches between games.
Closing a browser without logging out can therefore keep the seat for at most
the lease duration.

The registry is intentionally in process memory. Run exactly one Next.js
process. A multi-process, clustered, serverless, or multi-replica deployment
must replace it with an atomic shared store such as Redis before use. The unit
of enforcement is an opaque browser session, not a provable human identity;
deliberate cookie copying cannot be completely prevented. TLS and the HttpOnly
cookie reduce that risk.

## Public API allowlist

Only these authenticated data endpoints are implemented:

- `/api/public/games`
- `/api/public/games/:gameId/snapshot`
- `/api/public/posters/:assetId`

Viewer-session endpoints exist only under `/api/viewer/session*`. All other
`/api/*` paths fail closed with `404`, including transparent GZCTF login,
challenge details, raw events, containers, submissions, account, team, and
admin paths. Public scoreboard fetches never receive browser headers or cookies.
Only the server-held GZCTF cookie is sent to the exact identity and
participation endpoints described above.

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
4. Terminate TLS at Nginx, Caddy, or another trusted reverse proxy. Production
   viewer cookies are `Secure` and will not work over plain HTTP.
5. Run one viewer process unless the in-memory session and lease registry is
   replaced by Redis or another atomic shared store.
6. Configure the reverse proxy to overwrite, not append, the client IP header.
7. Apply network-level rate limits to `/api/viewer/session/login` and
   `/api/public/*`, and keep GZCTF management
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

Each request must return `404`. An unauthenticated request to
`/api/public/games` must return `401`. After player login, inspect a snapshot and
confirm it contains none of the excluded fields above. Verify that a second
browser using another member of the same team receives `409` while the first
seat remains active.

## Reporting a vulnerability

Do not include flags, credentials, tokens, or private event payloads in a public
issue. Contact the repository owner privately and rotate any exposed credential
before sharing diagnostic material.
