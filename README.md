# VaultKey — zero-knowledge password manager

**Stack:** Plasmo · React 18 · TypeScript · Tailwind CSS (extension) + Node.js/Express/TypeScript (API)

```
extension/   Plasmo MV3 extension (popup, background worker, autofill content script)
server/      Express API: auth + opaque encrypted-vault sync
```

## Run it
```bash
# 1) API
cd server && npm install && cp .env.example .env     # set JWT_SECRET (openssl rand -hex 32)
npm run dev                                            # http://localhost:4000

# 2) Extension
cd extension && npm install && cp .env.example .env
npm run dev                                            # then load build/chrome-mv3-dev via chrome://extensions → Load unpacked
```
The manifest key fixes the extension ID to `jbdocjhaconacdjjjogdffomhbfkjnjb`, which is already allowed by `server/.env.example`. If you change the key, update `ALLOWED_ORIGINS` in `server/.env` to match.
The extension defaults to light appearance; choose Light, Dark, or System in Settings to change it.
Production: `npm run build` / `npm run package`, host the API behind HTTPS, and set `PLASMO_PUBLIC_API_URL` + `host_permissions` accordingly.

## Security model
1. Master password + email → **PBKDF2-SHA256 (600k)** → **HKDF** → two independent values:
   `encKey` (AES-256-GCM, stays on device) and `authHash` (sent to server).
2. Server stores `scrypt(authHash, salt)` and an **encrypted blob it cannot read** (zero-knowledge).
3. Vault is local-first (`chrome.storage.local`, ciphertext only); sync uses optimistic versioning, conflicts are merged per entry (newest `updated` wins, deletes are tombstones).
4. Unlocked key lives only in `chrome.storage.session` (memory, not exposed to content scripts) and is wiped by auto-lock / browser restart.
5. Autofill only runs on explicit click, warns on URL mismatch (anti-phishing), and uses no `innerHTML` (React escapes output).
6. API: helmet, CORS allow-list, zod validation, rate-limited auth, JWT (12 h), constant-time comparison.

## API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | – | create account `{email, authHash}` |
| POST | /api/auth/login | – | returns JWT |
| PUT  | /api/auth/password | JWT | rotate master password + re-encrypted vault |
| GET  | /api/vault | JWT | `{blob, version}` |
| PUT  | /api/vault | JWT | `{blob, version}` → 200 / 409 + current blob |
