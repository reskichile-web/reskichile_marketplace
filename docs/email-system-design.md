# ReskiChile — Automated Email System (Design)

Status: **Proposal / for review** · Scope: **automated & triggered email only** · Transport: **Resend**

This document is the plan to approve before writing code. No code has been changed.

---

## 1. Goal & scope

Build a reliable system for **system-sent, event-triggered email**, honoring per-user
preferences (`users.notify_chat_email`, `users.notify_reminders_email`).

In scope (this phase):
- New-chat-message notification (to the recipient who isn't currently reading).
- Publication status changes (approved / rejected / "missing photos") → seller.
- Welcome email after first signup confirmation.
- Reminder emails (e.g. drafts left unpaid, stale "still available?" nudges) — cron-driven.

Explicitly **out of scope** for now (not selected): bulk/campaign blasts, a reusable
React-Email template framework as a standalone goal, and replacing the Supabase Auth
confirmation/reset emails. The architecture below leaves clean seams for all three.

---

## 2. Current state (recap)

Two unrelated channels exist today:

1. **Supabase Auth emails** — signup OTP, resend, password reset. Sent by Supabase, styled
   in the Supabase dashboard, not in this repo. Untouched by this project.
2. **App-sent email** — a single admin-only route `POST /api/admin/contact-seller`, using
   `nodemailer` + Gmail SMTP (`reskichile@gmail.com` / `GMAIL_APP_PASSWORD`), with an inline
   `bodyToHtml()` template. Two manual callers (invite users, ping sellers about listings).

`RESEND_API_KEY` is already in `.env.local` but **unused**. There is **no** automated/cron
email and nothing reads the `notify_*` preference columns yet.

---

## 3. The core constraint (why this isn't trivial)

The two events we want to email on are written **client-side via Supabase RLS**, with no
server route to hook into:

| Event | Where it's written | Path |
|---|---|---|
| New chat message | `ChatRoom.tsx:190` | `supabase.from('messages').insert(...)` (browser) |
| Product approve/reject/sold | `publicaciones/page.tsx:163,203` | `supabase.from('products').update(...)` (browser) |

So we cannot "add a `sendEmail()` call to the API route" — there is no API route in these
paths. We need a trigger mechanism that fires at the **database** layer, independent of which
client made the change.

### Chosen mechanism: Supabase Database Webhooks → Next.js route handlers

```
DB row change (INSERT messages / UPDATE products)
        │  Supabase Database Webhook (pg_net, fires on the DB, not the client)
        ▼
POST /api/email/hooks/<event>   (Next.js route on Vercel, gru1)
        │  verify shared secret · load context · check notify_* prefs · dedupe
        ▼
lib/email/send.ts  →  Resend API  →  recipient
        │
        ▼
email_log row (audit + idempotency)
```

Why this over the alternatives:
- **vs. refactoring message-send/status-update through API routes:** that's a large client
  refactor, loses the optimistic-insert + realtime simplicity in `ChatRoom`, and still
  wouldn't catch writes from the admin client or scripts. DB webhooks catch every write.
- **vs. Postgres trigger calling Resend directly via pg_net:** puts HTML templating and
  business logic in SQL. Keep logic in TypeScript; let the DB only *signal*.
- **vs. Supabase Edge Functions:** viable, but we already deploy Next.js on Vercel — keeping
  senders as Next routes means one codebase, one deploy, shared `lib/` and types.

Cron-driven reminders use **Vercel Cron** (`vercel.json` `crons`) hitting
`/api/email/cron/<job>`, same send/preference/log layer.

---

## 4. Proposed module layout

```
src/lib/email/
  client.ts        # Resend SDK singleton (reads RESEND_API_KEY)
  send.ts          # sendEmail() — single choke point: render + send + log + error handling
  render.ts        # shared HTML layout (header logo + celeste footer, dark-mode safe)
  templates/
    layout.ts      # the chrome currently inlined in contact-seller route, extracted
    new-message.ts
    publication-approved.ts
    publication-rejected.ts
    welcome.ts
    reminder-*.ts
  preferences.ts   # maps event type → which notify_* column gates it
  types.ts         # EmailEvent union, template prop types

src/app/api/email/
  hooks/
    new-message/route.ts        # Database Webhook target: messages INSERT
    publication-status/route.ts # Database Webhook target: products UPDATE (status changed)
  cron/
    draft-reminders/route.ts    # Vercel Cron
    stale-listing/route.ts      # Vercel Cron
```

`send.ts` is the **only** place that talks to Resend. Every caller (hooks, cron, and later
the migrated admin tools) goes through it, so preference-checking, logging, idempotency, and
error handling live in exactly one spot.

The existing `bodyToHtml()` chrome in `contact-seller/route.ts` becomes
`templates/layout.ts` — single source of branding. (Migrating `contact-seller` itself onto
Resend is a low-risk follow-up, not required this phase.)

---

## 5. Data model additions

Two pieces. Both should be added to `supabase/schema.sql` (note: `password_invites` and
`payments` are currently live-DB-only and undocumented — let's not repeat that).

### 5.1 `email_log` — audit + idempotency
```sql
CREATE TABLE public.email_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient    TEXT NOT NULL,
  event_type   TEXT NOT NULL,           -- 'new_message' | 'publication_approved' | ...
  dedupe_key   TEXT UNIQUE,             -- e.g. 'new_message:<conversation_id>:<window>'
  resend_id    TEXT,                    -- Resend message id, for webhook reconciliation
  status       TEXT NOT NULL DEFAULT 'sent',  -- sent | failed | skipped_pref | suppressed
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```
`dedupe_key` is the idempotency guard: webhooks can fire more than once (at-least-once
delivery), and chat bursts shouldn't mean one email per message. Insert-on-send; a unique
violation = already handled, skip.

### 5.2 Notification preferences
`notify_chat_email` and `notify_reminders_email` already exist on `users`. We need to:
- **Read** them in `preferences.ts` before sending.
- Consider an **unsubscribe/suppression** path (Resend supports it; or a one-click
  `/api/email/unsubscribe?token=...` that flips the column). Required if we ever approach
  bulk, good hygiene regardless.

> Note: `users.email` mirrors `auth.users.email`; confirm which is canonical for sending
> (auth.users is the source of truth for deliverable address). The hook should resolve the
> recipient via the service-role client.

---

## 6. The "new message" notification — detail (the hard one)

Naive "email on every message INSERT" is wrong: it would spam both parties during a live
back-and-forth. Rules:

1. Only notify the **recipient** (`conversation.buyer_id`/`seller_id` that is *not*
   `sender_id`).
2. Only if `recipient.notify_chat_email = true`.
3. **Debounce / presence:** don't email if the recipient is actively in the thread. We have
   `messages.read_at` and `delivered_at` and realtime presence. Practical rule: send only if
   the recipient hasn't read the conversation in the last N minutes *and* we haven't already
   emailed for this conversation within the debounce window (the `dedupe_key` carries a
   time-bucket). This collapses a 20-message burst into one "you have new messages" email.
4. Link to `/mensajes/<conversation_id>`.

This logic lives in `hooks/new-message/route.ts` + `preferences.ts`, all server-side with the
service-role client (RLS would otherwise hide the counterparty's row).

---

## 7. Infrastructure / setup checklist

1. **Resend domain auth** — verify `reskichile.cl` in Resend, add the SPF/DKIM/DMARC DNS
   records. Until then, deliverability of automated mail is poor and Gmail will spam-folder
   it. Pick the sending identity, e.g. `notificaciones@reskichile.cl` (and a `Reply-To`).
2. **Env:** `RESEND_API_KEY` (present). Add `EMAIL_WEBHOOK_SECRET` (shared secret to
   authenticate Database Webhook → route), `NEXT_PUBLIC_SITE_URL` (referenced in
   `invite-link/route.ts` but **not in `.env.local`** — currently falling back to the
   hardcoded default; set it explicitly).
3. **Supabase Database Webhooks** configured for `messages` INSERT and `products` UPDATE,
   pointing at the Vercel production URLs, sending the shared secret header.
4. **Vercel Cron** entries in `vercel.json` for the reminder jobs.
5. **Region:** functions are pinned to `gru1`; Resend calls are outbound HTTPS, fine.

---

## 8. Security

- Webhook routes are **public URLs** — they must verify `EMAIL_WEBHOOK_SECRET` (constant-time
  compare) and reject otherwise. They must never trust the payload's user identity; re-load
  the row by id with the service-role client.
- Cron routes verify the Vercel cron header / a secret.
- Escape all user-controlled content in templates (the existing `escapeHtml` is the baseline;
  message bodies and product titles flow into HTML).
- Rate-limit per recipient as a backstop against trigger storms.

---

## 9. Phased implementation plan

**Phase 0 — foundation (no user-visible change)**
- `lib/email/` skeleton: `client.ts`, `send.ts`, `render.ts`, extract `layout.ts` from
  `contact-seller`. `email_log` table + migration. Env + Resend domain verification.
- Deliverable: `send.ts` works end-to-end via a tiny admin test route or script.

**Phase 1 — publication status emails**
- Lowest risk (low volume, clear trigger, no debounce). `hooks/publication-status` +
  approved/rejected/missing-photos templates. Validates the whole webhook→send→log pipeline.

**Phase 2 — new-message notifications**
- The debounced recipient logic from §6. Most valuable, most complex.

**Phase 3 — welcome + cron reminders**
- Welcome on first confirmation; Vercel Cron jobs for draft/stale-listing nudges, gated by
  `notify_reminders_email`. Add the unsubscribe path here.

**Phase 4 (optional follow-up)** — migrate `contact-seller` off Gmail SMTP onto the shared
Resend layer; retire `GMAIL_APP_PASSWORD`.

---

## 10. Open questions for you

1. **Sending identity:** `notificaciones@reskichile.cl`? Different `Reply-To` (e.g. the Gmail)
   so replies reach a human? Do you control `reskichile.cl` DNS to add Resend records?
2. **New-message debounce window** — 5 min? 15 min? "Only if unread after X and not emailed
   in the last Y."
3. **Reminder policy** — what exactly triggers a reminder, and how often (drafts unpaid after
   N days? approved-but-old listings)? This defines the cron jobs.
4. **Auth emails** — leaving Supabase's confirmation/reset emails as-is for now, correct? (We
   *can* fold them in later via custom SMTP, but it's a separate decision.)
5. **Welcome email** — Supabase already sends a confirmation; is a separate branded welcome
   wanted, or fold the welcome message into the confirmation template instead?
