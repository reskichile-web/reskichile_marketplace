# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ReskiChile is a Chilean marketplace for second-hand ski/snowboard gear. UI copy and route
segments are in Spanish (`/catalogo`, `/vender`, `/mis-productos`, `/mensajes`, `/perfil`).
Next.js 14 App Router + Supabase (auth, Postgres, storage, realtime) + Transbank Webpay
(publication-fee payments) + Gmail SMTP (transactional email).

## Commands

```bash
npm run dev      # dev server on port 4173 (NOT 3000 — README is stale boilerplate)
npm run build    # next build
npm run start    # production server
npm run lint     # next lint (eslint-config-next, core-web-vitals + typescript)
```

There is no test suite. "Verifying" a change means `npm run build` + `npm run lint` and/or
exercising the flow in the dev server.

### One-off data scripts (`scripts/*.mjs`)

Run directly with node, e.g. `node scripts/import-products.mjs`. They read `../.env.local`
for `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` and talk to Supabase with the service-role
key (bypasses RLS). Used for bulk import from `scripts/productos.xlsx`, orphan-storage
cleanup, and user/data restores — destructive, run deliberately.

## Environment

`.env.local` keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `PUBLICATION_FEE_CLP` (publish fee in CLP, default 5000),
`RESEND_API_KEY`, `GMAIL_APP_PASSWORD` (Gmail app password for the nodemailer SMTP sender).

`next.config.mjs` whitelists remote images from `**.supabase.co` and `images.unsplash.com`.
`vercel.json` pins the function region to `gru1` (São Paulo). `.npmrc` sets `omit=optional`.

## Architecture

### Supabase client — three flavors, pick deliberately

- `src/lib/supabase/client.ts` → `createClient()`: browser client (anon key), for Client
  Components.
- `src/lib/supabase/server.ts` → `createServerSupabaseClient()`: cookie-bound server client
  (anon key, respects RLS as the logged-in user). Default for Server Components / route
  handlers.
- `src/lib/supabase/server.ts` → `createServiceRoleClient()`: **bypasses RLS**. Only for
  trusted server work (admin routes, system writes). Never expose its results unfiltered to
  a user who shouldn't see them.

`src/lib/auth.ts` → `getAuthUser()` is `React.cache`-wrapped: it dedupes the
`getUser()` + `users` profile lookup (is_admin / avatar / name) within one server request.
**Call it from Server Components instead of `supabase.auth.getUser()` directly.**

### Middleware (`src/middleware.ts` + `src/lib/supabase/middleware.ts`)

- Rewrites legacy `/ski-rack-*` IG links to `/ski-rack`.
- `updateSession` refreshes the auth cookie and sets an `x-pathname` request header (Next
  doesn't expose pathname to Server Components otherwise — read it where layout needs the
  current path).
- **Perf-sensitive:** it only does the network `getUser()` round-trip on protected prefixes
  (`/mis-productos`, `/perfil`, `/admin`, and any `*/editar`). Public routes only do a local
  `getSession()`. Unauthenticated hits on protected routes redirect to
  `/auth/login?redirect=<path>`. If you add a new gated route, add its prefix here too.

### Auth redirect convention

After any successful auth (login/registro/reset/invite), call
`redirectAfterAuth()` from `src/lib/auth-redirect.ts`. It sends `is_admin` users to `/admin`,
everyone else to the fallback, and always calls `router.refresh()` so the server-rendered
Header picks up the new session. Admins land on `/admin` after *every* auth flow, not just
login.

### Data model (`supabase/schema.sql` is the source of truth)

`public.users` 1:1 with `auth.users` (auto-created by the `handle_new_user` trigger on
signup). `products` → `product_images` (1:many, ordered by `"order"`). `conversations` →
`messages` (buyer↔seller chat, one conversation per `(product, buyer, seller)`).

- **Product lifecycle** (`status`): `draft` → (pay publication fee) → `pending` → admin
  review → `approved` / `rejected`; plus `sold`, `archived`, `missing_photos`. RLS exposes
  only `approved` products to the public; sellers see their own; admins see all.
- **Per-type attributes** live in `products.attributes` (JSONB), not columns. The shape per
  `product_type` is documented inline in `schema.sql` and mirrored in `src/lib/types.ts` /
  `src/lib/constants.ts` (`PRODUCT_TYPES`, `CONDITIONS`, `PRODUCT_STATUSES`, `REGIONS`,
  tallas, sexos). Keep these three in sync when adding a type/field.
- **RLS is the security boundary.** Most tables are client-readable directly under RLS;
  cross-user fields that RLS can't expose go through `SECURITY DEFINER` RPCs — e.g.
  `is_seller_phone_hidden(uuid)` for the phone-hide flag. Don't try to read another user's
  row directly from the client.

### Chat (realtime)

`conversations` + `messages` use Supabase Realtime (`REPLICA IDENTITY FULL`, added to
`supabase_realtime` publication). Client wiring is in `src/components/chat/`
(`ChatProvider`, `ChatRoom`) and `src/lib/chat.ts`. Two server guards matter:

- `conversations_overview()` RPC aggregates last-message + unread-count per conversation in
  one round trip (used by `/mensajes` and `/perfil`) — prefer it over scanning messages.
- Recipients may only flip `delivered_at` / `read_at`. This is enforced twice: the RLS
  UPDATE policy (`sender_id <> auth.uid()`) and the `guard_messages_update` trigger that
  rejects any change to `body`/`sender_id`/etc. Don't loosen one without the other.

### Payments (Transbank Webpay Plus)

`src/lib/transbank.ts` is currently hardcoded to **Integration (sandbox)** credentials —
switch to production `Options` before going live. Flow: `POST /api/payment/create`
(verifies the product is the user's own `draft`, creates a `payments` row + Webpay
transaction, returns the redirect URL) → user pays → `/api/payment/confirm` commits the
token, marks the payment `approved`/`rejected`, and on success moves the product
`draft → pending` (into the admin review queue). Note: the `payments` table is **not** in
`schema.sql` — it exists in the live DB only.

### Product search

`SearchBar` (header) does live search via the `search_products(q, max_results, relaxed)`
RPC: pg_trgm + unaccent over `products.search_text` (normalized concat of brand, model,
type synonyms ES/EN, condition, description, attributes, location — maintained by the
`products_search_text_sync` trigger). Strict mode requires every word to match
(substring or fuzzy); the frontend falls back to `relaxed: true` so something always
shows. Brand/model/type matches outrank description-only matches. SECURITY INVOKER —
anon only sees approved products. Type synonyms live in `product_type_synonyms()` (SQL);
update it when adding a product type.

### Observability (first-party analytics)

All events flow through `track()` in `src/lib/track.ts` → `POST /api/track` →
`public.events` (service-role insert; bot UAs filtered, `/admin` + `/api` paths ignored,
anonymous `rv_id` visitor cookie, geo from Vercel `x-vercel-ip-*` headers — null in dev,
**admin sessions are never recorded**). Event types: `pageview` (PageViewTracker in root
layout; on `/catalogo` it also reports the `product_type` search param as `category`),
`product_view` (TrackProductView — rendered by `/producto/[id]` only when the viewer is
neither owner nor admin, so self-views never count), `click` (landing: TrackedLink hero
CTAs, CategoryCard links, ProductCard `trackClickAs`), `login`/`signup` (auth pages +
`invite_redeem` server-side), `invite_open` (TrackInviteOpen on `/i/[slug]`; also stamps
`password_invites.opened_at`).

Reads: SELECT on `events` is admin-only RLS. Private per-product counters go through the
`product_view_counts(uuid[])` SECURITY DEFINER RPC (owner-or-admin), shown in
`/producto/[id]`, `/mis-productos` and `/admin/publicaciones`. `/admin/metricas`
aggregates via SECURITY INVOKER RPCs (`admin_daily_visits`, `admin_category_views`,
`admin_landing_clicks`, `admin_top_products`). No third-party analytics.

### Email

Automated transactional email goes through **Resend** via `sendEmail()` in
`src/lib/email/send.ts` (from `noreply@reskichile.cl`, `RESEND_API_KEY`). Templates live in
`src/lib/email/templates.ts` (shared celeste `layout()` + `contactBlock()`; senders:
review, approved, chat, sale, sale-reminder, internal-notice). The only Gmail-SMTP sender
(nodemailer, `GMAIL_APP_PASSWORD`) is the admin's manual `contact-seller` route. User-facing
opt-outs live on `users.notify_chat_email` / `notify_reminders_email` (currently only chat
honors them).

### Sold flow & 30-day reminder

Sellers mark their own listing sold via `MarkSoldButton` (mis-productos + product detail) →
`POST /api/products/[id]/sold` → `markProductSold()` in `src/lib/sold.ts`: sets
`status=sold` + `sale_price`/`sold_channel`/`sold_speed`/`sold_at`, mints a single-use
**undo** token in `product_action_tokens`, and emails the seller (BCC `reskichile@gmail.com`)
with an undo button. Undo is only reachable from the email — not the site UI. Emailed
one-click links land on scanner-safe pages under `/p/*` (`/p/venta/deshacer/[token]`,
`/p/vendi/[token]`, `/p/disponible/[token]`) that render on GET and mutate only on the
button's POST (mirrors the `/i/[slug]` invite pattern). A Vercel cron
(`/api/cron/sale-reminders`, daily, guarded by `CRON_SECRET`) emails the "¿lo vendiste?"
reminder to listings with `days_published >= 30`, re-reminding every ~30 days; "Sí" →
confirm-sold token, "No, sigue disponible" → notifies the team + resets the clock.

### App layout & routing

- `src/app/layout.tsx` is the root shell; `src/components/LayoutChrome.tsx` decides
  Header/Footer chrome (the admin area uses `AdminNav` instead and must not leak onto public
  pages — a recurring bug area, see git history).
- `src/app/admin/*` is the gated admin console (dashboard, usuarios, publicaciones,
  finanzas). `src/app/api/admin/*` are its service-role-backed endpoints.
- Invite flow: `/i/[slug]` (redeem an invite link) + `/api/admin/invite-link` +
  `/api/auth/redeem-invite`.
- Most route folders ship a `loading.tsx`; route-specific skeletons live in
  `src/components/skeletons/`.

### Conventions

- Path alias `@/*` → `src/*` (tsconfig). TypeScript `strict` is on.
- UI: Tailwind (config in `tailwind.config.ts`) + a small shadcn-style primitive set in
  `src/components/ui/`. Animation via framer-motion / gsap. Icons via lucide-react /
  react-icons.
- **Phone numbers** are stored canonically as `+<country><local>` (regex-checked in the DB).
  Always normalize through `src/lib/phone.ts` (`normalizeStoredPhone`, `phoneToWhatsApp`) at
  every boundary — never persist raw input.
- Client image handling: `browser-image-compression` + `heic2any` (iPhone HEIC →
  web) before upload; helpers in `src/lib/image-utils.ts` / `src/lib/storage-utils.ts`.
  Storage bucket is `product-images` (public-read; users may only delete under their own
  `auth.uid()` folder prefix).

### Reference docs

`docs/auth-flow-guide.md` documents the full auth/redirect behavior. Other `docs/*.md` are
Spanish business-strategy notes (competition, financing, import logistics), not engineering
docs.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
