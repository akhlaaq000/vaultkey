# VaultKey — zero-knowledge password manager

**Stack:** WXT · React 18 · TypeScript · Tailwind CSS (extension) + Node.js/Express/TypeScript/SQLite (API)

```
extension/   WXT MV3 extension (popup, background worker, autofill content script)
server/      Express API: auth + opaque encrypted-vault sync
```

## Run it
```bash
# 1) API
cd server && npm install && cp .env.example .env     # set JWT_SECRET (openssl rand -hex 32)
npm run dev                                            # http://localhost:4000

# 2) Extension
cd extension && npm install && cp .env.example .env
npm run dev                                            # load .output/chrome-mv3-dev via chrome://extensions → Load unpacked
```
The development build is named **VaultKey Password Manager (WXT Dev)** and uses the WXT dev server on port 3000. Remove older **DEV**/Plasmo builds from `chrome://extensions`; those stale builds may try to connect to the retired port 1815.
The manifest key fixes the extension ID to `jbdocjhaconacdjjjogdffomhbfkjnjb`, which is already allowed by `server/.env.example`. If you change the key, update `ALLOWED_ORIGINS` in `server/.env` to match.
The extension defaults to light appearance; choose Light, Dark, or System in Settings to change it.
Production: `npm run build` / `npm run package`, host the API behind HTTPS, and set `WXT_PUBLIC_API_URL` + `host_permissions` accordingly.

The API stores accounts and encrypted vaults in `server/data/vaultkey.sqlite` using Node.js's built-in SQLite support (Node.js 22.13 or newer). No JSON database or migration file is used.

## Tests and browser builds
```bash
cd extension && npm test && npx tsc --noEmit && npm run build && npm run build:firefox
cd ../server && npm test && npx tsc --noEmit -p tsconfig.test.json && npm run build
```
The Firefox build command targets Firefox MV3 (Firefox 140+); Chrome builds target MV3. Firefox metadata declares the account email and authentication-related data categories used by the encrypted sync service. Build validation is not a substitute for interactive browser testing. See [test results](./docs/test-results.md).

## Security model
1. Master password + email → **PBKDF2-SHA256 (600k)** → **HKDF** → two independent values:
   `encKey` (AES-256-GCM, stays on device) and `authHash` (sent to server).
2. Server stores `scrypt(authHash, salt)` and an **encrypted blob it cannot read** (zero-knowledge).
3. Vault is local-first (`chrome.storage.local`, ciphertext only); sync uses optimistic versioning, conflicts are merged per entry (newest `updated` wins, deletes are tombstones).
4. Unlocked key lives only in `chrome.storage.session` (memory, not exposed to content scripts) and is wiped by auto-lock / browser restart.
5. Autofill only runs on explicit click, warns on URL mismatch (anti-phishing), and uses no `innerHTML` (React escapes output).
6. API: helmet, CORS allow-list, zod validation, rate-limited auth, JWT (12 h), constant-time comparison.
7. Login capture runs after typing pauses in a visible password field, when that field loses focus, or when its form is submitted; credentials remain pending until you confirm Save in the extension.

## API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | – | create account `{email, authHash}` |
| POST | /api/auth/login | – | returns JWT |
| PUT  | /api/auth/password | JWT | rotate master password + re-encrypted vault |
| GET  | /api/vault | JWT | `{blob, version}` |
| PUT  | /api/vault | JWT | `{blob, version}` → 200 / 409 + current blob |
