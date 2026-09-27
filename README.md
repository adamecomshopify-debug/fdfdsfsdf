# AdamEcom automations

Code of the Cloudflare Worker `adamecom-automations`, served at https://app.adam-ecom.online/.

- `src/index.js`: the Worker as deployed on Cloudflare (bundled output, pulled on 2026-09-27).
- `schema/schema.sql`: structure of the D1 database `adamecom` (tables and indexes, no data).
- `wrangler.toml`: Worker config (D1 binding `DB`, crons, custom domain, variables). Secrets are not stored here.

Deploy: `npx wrangler deploy`.
