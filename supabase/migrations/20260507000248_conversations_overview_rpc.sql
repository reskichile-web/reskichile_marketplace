-- Aggregates the conversations list page in one round trip.
-- Replaces the previous client-side approach that fetched every message body
-- across every conversation just to compute "last message" + "unread count".
--
-- Returns one row per conversation the caller participates in, ordered by
-- last_message_at DESC. RLS on conversations + messages still applies
-- (SECURITY INVOKER), so the function never leaks past auth.

create or replace function public.conversations_overview()
returns table (
  id uuid,
  product_id uuid,
  buyer_id uuid,
  seller_id uuid,
  last_message_at timestamptz,
  created_at timestamptz,
  last_body text,
  last_sender_id uuid,
  last_message_created_at timestamptz,
  last_delivered_at timestamptz,
  last_read_at timestamptz,
  unread_count integer
)
language sql
security invoker
stable
set search_path = public, pg_temp
as $$
  with me as (
    select auth.uid() as uid
  ),
  user_convs as (
    select c.*
    from public.conversations c, me
    where c.buyer_id = me.uid or c.seller_id = me.uid
  ),
  last_msg as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.body,
      m.sender_id,
      m.created_at,
      m.delivered_at,
      m.read_at
    from public.messages m
    where m.conversation_id in (select id from user_convs)
    order by m.conversation_id, m.created_at desc
  ),
  unread as (
    select m.conversation_id, count(*)::int as cnt
    from public.messages m, me
    where m.conversation_id in (select id from user_convs)
      and m.read_at is null
      and m.sender_id <> me.uid
    group by m.conversation_id
  )
  select
    uc.id,
    uc.product_id,
    uc.buyer_id,
    uc.seller_id,
    uc.last_message_at,
    uc.created_at,
    lm.body          as last_body,
    lm.sender_id     as last_sender_id,
    lm.created_at    as last_message_created_at,
    lm.delivered_at  as last_delivered_at,
    lm.read_at       as last_read_at,
    coalesce(u.cnt, 0) as unread_count
  from user_convs uc
  left join last_msg lm on lm.conversation_id = uc.id
  left join unread   u  on u.conversation_id  = uc.id
  order by uc.last_message_at desc nulls last;
$$;

-- Restrict execution to authenticated users only — anon should never call it.
revoke all on function public.conversations_overview() from public;
revoke all on function public.conversations_overview() from anon;
grant execute on function public.conversations_overview() to authenticated;
;
