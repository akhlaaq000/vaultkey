# Automated test and build results

Validation run locally on 2026-10-27 after the WXT and SQLite migration.

| Area | Command | Result |
|---|---|---|
| Extension tests | `cd extension && npm test` | Passed: 43 tests across 7 files |
| Extension types | `cd extension && npx tsc --noEmit` | Passed |
| Chrome target | `cd extension && npm run build` | Passed: Chrome MV3 |
| Firefox target | `cd extension && npm run build:firefox` | Passed: Firefox MV3 (Firefox 140+) |
| Server tests | `cd server && npm test` | Passed: 11 tests across 3 files |
| Server and test types | `cd server && npx tsc --noEmit -p tsconfig.test.json` | Passed |
| Server build | `cd server && npm run build` | Passed |
| Dependency audits | `cd extension && npm audit`; `cd server && npm audit` | Passed: 0 vulnerabilities in both workspaces |

Extension automated coverage includes key derivation and authenticated encryption, generated passwords, authentication form validation and register/login flows, configurable auto-lock, lock/session behavior, encrypted local persistence, credential add/edit/delete/copy and search, paused-input and submitted-form login capture, duplicate-capture suppression, explicit autofill, and capture prompt handoff.

Server automated coverage includes security headers, CORS allow-list behavior, registration/login validation and password hashing, JWT verification and expiry, isolated encrypted-vault storage, optimistic concurrency, password rotation, rate limiting, and a client-crypto-to-API-to-client-decryption integration test. Server tests create temporary SQLite databases and clean them up.

The Firefox and Chrome results above verify successful target builds only. Interactive Firefox runtime behavior and cross-browser user acceptance have not been tested; run the extension in both browsers before claiming full runtime compatibility.
