-- Pin search_path on touch_conversation_last_message to silence the
-- function_search_path_mutable advisor and remove a small DEFINER-style risk
-- (the trigger is INVOKER, so this is precautionary).

create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;
;
