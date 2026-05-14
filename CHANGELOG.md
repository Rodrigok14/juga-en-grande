# Changelog

This file records meaningful project changes, technical decisions, and operational updates.

## 2026-05-14

### Digital Catalog Foundation

- Added schema support for `display_order`, `digital_file_url`, and `digital_file_name` on products.
- Expanded the admin product form to manage portada, archivo digital, descripcion, precio, stock, estado, and store order from one place.
- Updated product APIs so digital products can store a PDF or ZIP file without exposing that file in the public catalog payload.
- Changed product ordering so digital items can be prioritized in the storefront through `display_order` and digital-first sorting.

### Checkout And Delivery Split

- Split checkout behavior between digital and physical orders.
- Added order metadata for `delivery_type`, shipping fields, and an access token for post-payment order access.
- Restricted physical orders to Tucuman, Argentina in the checkout validation flow.
- Added post-payment order access endpoints so approved digital orders can expose download buttons after Mercado Pago confirmation.

### Infrastructure And Workflow

- Confirmed local workspace `bookstore` matches GitHub repository `Rodrigok14/juga-en-grande`.
- Linked local workspace to Vercel project `juga-en-grande`.
- Confirmed Vercel environment variables are configured for the deployed project.
- Confirmed Supabase project `book` with id `evlymtimizxlrmlzznip` is the active database host for the project.
- Normalized this workspace onto branch `codex/cf26-work` because local `main` is owned by another worktree.

### Documentation

- Added `PROJECT_CONTEXT.md` to hold stable project context and operating conventions.
- Added `CHANGELOG.md` to track meaningful technical and operational changes over time.

## Entry Format

For future updates, prefer entries that include:

- date
- what changed
- why it changed
- whether it affected code, deployment, database, or workflow
