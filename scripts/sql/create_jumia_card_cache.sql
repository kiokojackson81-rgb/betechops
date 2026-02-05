CREATE TABLE IF NOT EXISTS public.jumia_card_cache (
  week_start timestamptz NOT NULL,
  shop_sid uuid,
  total numeric,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (week_start, shop_sid)
);

CREATE INDEX IF NOT EXISTS idx_jumia_card_cache_week_start ON public.jumia_card_cache(week_start);
CREATE INDEX IF NOT EXISTS idx_jumia_card_cache_shop_sid ON public.jumia_card_cache(shop_sid);
