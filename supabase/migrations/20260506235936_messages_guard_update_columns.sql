-- Guard against unintended updates to messages columns.
-- The RLS policy `messages_update_recipient_read` allows the recipient to UPDATE,
-- but is column-blind: it only enforces sender_id <> auth.uid(). Without this
-- trigger, the recipient could overwrite body, created_at, sender_id, etc.
-- This trigger restricts the UPDATE surface to delivered_at and read_at only.

create or replace function public.guard_messages_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'messages: only delivered_at and read_at may be updated'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_update_columns on public.messages;
create trigger messages_guard_update_columns
before update on public.messages
for each row execute function public.guard_messages_update();
;
