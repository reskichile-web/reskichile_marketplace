-- Support the common analytics query shape: event type + date range + unique
-- visitor aggregation. This keeps metrics reads from scanning the whole table.
CREATE INDEX IF NOT EXISTS events_type_created_visitor_idx
  ON public.events (event_type, created_at DESC, visitor_id);
