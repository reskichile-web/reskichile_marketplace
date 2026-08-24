-- The admin calendar reads immutable publication history by its original
-- Chilean schedule date and slot. Keep that lookup fast as history grows.

CREATE INDEX IF NOT EXISTS instagram_story_publications_schedule_idx
  ON public.instagram_story_publications (
    scheduled_local_date DESC,
    scheduled_slot ASC
  )
  WHERE scheduled_local_date IS NOT NULL;
