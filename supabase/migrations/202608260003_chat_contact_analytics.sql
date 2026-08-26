-- A buyer/product pair has a single internal-chat conversion. The chat UI can
-- retry messages safely without inflating campaign or Meta contact metrics.
CREATE UNIQUE INDEX IF NOT EXISTS events_chat_contact_buyer_product_unique_idx
  ON public.events (user_id, product_id)
  WHERE event_type = 'click'
    AND event_name = 'chat_contact'
    AND user_id IS NOT NULL
    AND product_id IS NOT NULL;
