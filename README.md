# krypton-admin

KRYPTON Admin is an Angular portal with Cloudflare Pages Functions and D1 records/sessions. Credentials are sent in POST bodies; sessions use HttpOnly, SameSite cookies. File entries are manually entered metadata/links; the app does not upload file contents.

## Requirements

- Node.js and npm
- A Cloudflare account with Pages and D1 available
- Wrangler authenticated to that account for remote provisioning/deployment

Cloudflare's free plan has usage limits and those limits can change. Check current Pages/Workers, D1, and R2 pricing and quotas before relying on the free tier.

## Local setup

```powershell
npm install
npm run d1:migrate:local
Copy-Item .dev.vars.example .dev.vars
npm run pages:dev
```

Create a local-only bootstrap secret in `.dev.vars` before creating the first admin. Do not commit `.dev.vars`. The Pages dev server runs the Angular app and API together at the URL Wrangler prints.

Create the local first admin using the bootstrap secret in an `Authorization: Bearer ...` header and a JSON POST to `/api/auth/bootstrap` with `email` and a password of at least 12 characters. Use a REST client or PowerShell `Invoke-RestMethod`; never put the secret or password in the URL. Bootstrap only works while the users table is empty. Remove the local secret after setup.

## Cloudflare deployment

1. Sign in with `npx wrangler login`.
2. The existing `krypton-manage-db` database is configured in `wrangler.jsonc`. Confirm its ID in Cloudflare matches the supplied ID before continuing.
3. Apply the production schema with `npm run d1:migrate:remote`. This adds the app's tables to the existing database; back up any data already in that database first.
4. Create the Pages project with `npm run pages:project:create`.
5. Set the one-time admin bootstrap secret using `npx wrangler pages secret put BOOTSTRAP_SECRET --project-name krypton-admin`.
6. Deploy with `npm run pages:deploy`.
7. POST the first administrator to `https://<your-pages-domain>/api/auth/bootstrap` with the bootstrap secret in the Authorization header and the email/password in a JSON body. Then remove the setup secret with `npx wrangler pages secret delete BOOTSTRAP_SECRET --project-name krypton-admin`.

For Git-connected Pages deployments, use `npm run build` as the build command and `dist/krypton-admin/browser` as the build output directory. Keep the `functions/` directory at the repository root so Pages deploys the API routes alongside the Angular assets.

## Data and uploads

The D1 migration creates tables for administrators, sessions, login throttling, and portal records. The first-admin route is disabled after an account exists. The Files section stores manually entered file names, types, notes, and optional HTTPS links; file contents are not uploaded. The Settings backup downloads a JSON export of portal records.

The previous Google Apps Script backend and its spreadsheet are not included in this repo, so this creates an empty Cloudflare data store. Export/import existing records separately before switching users to the new deployment. Do not reuse the password exposed in the earlier request URL; rotate it before creating the new admin.