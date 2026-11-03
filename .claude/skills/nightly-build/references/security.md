# Security pass (5 minutes, every feature that touches input, auth, data, money, or an LLM)

## Think like an attacker first
1. **Trust boundaries:** where does outside data enter? Form fields, URLs, uploads, webhooks, third-party APIs,
   files, environment, and **LLM output**. Trust follows who wrote a value, not which channel delivered it.
2. **Assets:** what's worth stealing or breaking (credentials, personal data, money, admin actions)?
3. **Abuse case per feature:** "how would I misuse this?" — make that a test.

## Always
- Validate external input at the boundary (schema validation, e.g. Zod/Pydantic); cap sizes.
- Parameterized queries only. Framework auto-escaping for output; never `innerHTML`/`eval` with user data.
- Secrets in environment variables; commit `.env.example`, never `.env`. Hash passwords with bcrypt/scrypt/argon2.
- HTTPS; httpOnly + secure + sameSite cookies; never store auth tokens in localStorage.
- Generic error messages to users; details only in server logs (and never log passwords, tokens, or full card numbers).
- Run the package manager's audit (`npm audit`, `pip-audit`) when dependencies change; note high/critical findings.

## Prepare, never do (owner decides)
New auth flows or auth-logic changes on a product with real users · storing new kinds of personal or payment data ·
new paid third-party integrations · loosening CORS · granting elevated roles.

## LLM features
Model output is untrusted input: parse and validate against a schema before using it; never pass it to a shell,
SQL, `eval`, a file path, or raw HTML. Text the model reads (user messages, fetched pages, PDFs) can carry
instructions — enforce permissions in code, not in the prompt. Keep secrets out of prompts; cap tokens, rate, and
tool-call depth.

## Quick STRIDE check per boundary
Spoofing (auth?) · Tampering (integrity, parameterized queries?) · Repudiation (audit log for sensitive actions?) ·
Information disclosure (field allowlists, generic errors?) · Denial of service (rate limits, size caps, timeouts?) ·
Elevation of privilege (authorization checked server-side on every request?).
