# Project Context

## Overview

`Jugá en Grande` is a bookstore/ecommerce project with a public storefront, admin panel, PostgreSQL-backed catalog/orders, Mercado Pago checkout, and Vercel deployment.

## Repositories And Platforms

- Local workspace: `C:\Users\Microsoft\.codex\worktrees\cf26\bookstore`
- GitHub repository: `https://github.com/Rodrigok14/juga-en-grande`
- Vercel project: `juga-en-grande`
- Production URL: `https://juga-en-grande.vercel.app`
- Supabase project: `book`
- Supabase project id: `evlymtimizxlrmlzznip`
- Database host: `db.evlymtimizxlrmlzznip.supabase.co`

## Current Stack

- Frontend: static HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express
- Database: PostgreSQL via `pg`
- Payments: Mercado Pago
- File storage:
  - Local: `assets/uploads`
  - Vercel: `@vercel/blob`
- Deployment: Vercel

## Key Files

- `index.html`: public homepage
- `catalogo.html`: catalog listing
- `producto.html`: product detail
- `carrito.html`: cart
- `checkout.html`: checkout
- `admin.html`: admin panel
- `server.js`: main Express app
- `api/index.js`: serverless entry for Vercel
- `lib/db.js`: PostgreSQL connection and seed logic
- `vercel.json`: Vercel routing/build config

## Environment Variables

Minimum confirmed variables:

- `DATABASE_URL`
- `MP_ACCESS_TOKEN`
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `BASE_URL`
- `PG_SSL_REJECT_UNAUTHORIZED` when needed
- `DATABASE_SSL=false` for local Postgres without SSL
- `BLOB_READ_WRITE_TOKEN` in Vercel for uploads

## Working Flow

1. Request the change clearly.
2. Implement the change in the local workspace.
3. Verify locally when needed.
4. Commit the change with a clear message.
5. Push to GitHub.
6. Let Vercel redeploy from the connected branch or merge to `main` for production.
7. Validate the live result if the change affects production behavior.

## Git Workflow Notes

- This workspace currently works on branch `codex/cf26-work`.
- `origin/main` is the production base branch.
- Another worktree already owns local `main`, so this workspace should avoid switching directly to `main`.

## Documenting Decisions

Use this file for stable project context:

- platform links
- architectural decisions
- deployment assumptions
- workflow conventions
- known constraints

Use `CHANGELOG.md` for dated change entries.

## Known Constraints

- Some platform connectors can fail intermittently by session and may need reconnection.
- There are no formal `npm test` or `npm lint` scripts yet.
- Database access is application-driven through `DATABASE_URL`; platform details should be validated against Vercel env when needed.

## Next Priorities

- Keep documentation current when architecture or workflow changes.
- Standardize verification steps for frontend, admin, checkout, and deploy.
- Add formal scripts for validation when the project matures.
- Add secure post-payment delivery for digital files without exposing download URLs publicly.
