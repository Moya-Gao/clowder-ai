# v0.10.0 (Draft — pending sync to clowder-ai)

> Status: draft, baseline collecting changes since v0.9.0. Will be finalized at next public sync.

## Highlights

- **Security hotfix**: internal admin and debug routes now require owner authentication. See [Compatibility & Upgrade Notes](#compatibility--upgrade-notes-v0100) for action required by remote-access users.

## Security

### Hardened owner/network gates on internal admin and debug routes (clowder-ai#835)

Two internal surfaces were tightened to use the shared owner gate (`requirePrivilegedRouteOwner`):

- **F163 memory admin** — `POST /api/f163/promote`, `POST /api/f163/compress/scan`, `POST /api/f163/compress/apply`, `GET /api/f163/expand/:anchor`.
- **Prompt-capture debug** (only active when `PROMPT_CAPTURE=on`) — `GET /api/debug/prompt-captures` (+ `/status`, `/:captureId`, `POST /prune`).

Each endpoint now requires three layers:
1. An authenticated session (`/api/session` issues this automatically when the UI loads).
2. Either a direct loopback request **or** `DEFAULT_OWNER_USER_ID` configured.
3. The session user must match `DEFAULT_OWNER_USER_ID` when it is configured.

Previously, `expand/:anchor` had no guard at all, and prompt-captures only required any session (including the auto-issued `default-user`), so a multi-user or reverse-proxied deployment could read memory evidence or captured prompts across users.

Refs: commit `354a9377c`, PR cat-cafe#2077.

---

## Compatibility & Upgrade Notes (v0.10.0)

### What changes for users

For **typical single-user localhost** (`http://127.0.0.1:3001` from the same Mac, no proxy): **no action required**. The UI keeps working as before. Only the surfaces above are affected — chat, threads, memory consumption, settings, etc. are untouched.

### Deployment-scenario impact matrix

| Scenario | Chat / threads / memory consume | F163 memory admin tools | Prompt-capture debug (`PROMPT_CAPTURE=on`) |
|---|---|---|---|
| Single-user, localhost (default) | ✅ no change | ✅ no change | ✅ no change |
| Mac host + **Tailscale phone client** | ✅ no change (these endpoints are not used by the chat UI) | ⚠️ blocked unless `DEFAULT_OWNER_USER_ID` is set | ⚠️ HubTraceTree "view prompt capture" blocked unless `DEFAULT_OWNER_USER_ID` is set |
| Mac + reverse proxy / Cloudflared | ✅ no change | ⚠️ same as Tailscale (proxied loopback no longer satisfies the loopback check) | ⚠️ same as Tailscale |
| NAS / Docker / shared deployment | ✅ no change | ⚠️ same as Tailscale, plus you should set `DEFAULT_OWNER_USER_ID` for any multi-user isolation | ⚠️ same |

### Existing Users Action Required

If you access the admin/debug surfaces above from anywhere other than the same Mac that runs the server (Tailscale phone, reverse proxy, remote SSH port-forward, etc.), set the following environment variable before starting the API:

```bash
# .env (or your launcher's env injection)
DEFAULT_OWNER_USER_ID=<your-stable-user-id>
```

Where `<your-stable-user-id>` is the `userId` the API stamps onto your session. To find it on a running instance:

```bash
curl http://127.0.0.1:3001/api/session -c /tmp/cookies.txt
# Inspect the response body — it includes `userId`.
```

Once `DEFAULT_OWNER_USER_ID` matches the session's `userId`, the same UI session continues to work from any network path (Tailscale, reverse proxy, etc.) without further changes.

### What does *not* change

- The chat UI, message sending, thread listing, memory browse / consume, settings panel, and most user-facing features make **no** F163-admin or prompt-capture calls. Tailscale users who just "play with cats from their phone" are not affected at all.
- `PROMPT_CAPTURE` defaults to **off**. Unless you explicitly opt into prompt capture for debugging, the prompt-capture surfaces are inert regardless of network path.

### If you cannot set `DEFAULT_OWNER_USER_ID`

For ad-hoc one-off admin commands, you can still SSH to the host Mac and `curl 127.0.0.1` locally — direct loopback continues to work without `DEFAULT_OWNER_USER_ID`.

---

## Provenance

- Source commits: `354a9377c` (cat-cafe `fix(security): harden internal admin and debug route gates`)
- Related opensource issue: `clowder-ai#835` (kept OPEN pending public-wording decision; the issue's broader claims about session lifecycle / etc. were classified as P2 hardening, not in this hotfix scope)
- Lessons learned: `LL-070` (Security hotfix must include opensource deployment-scenario impact analysis)
