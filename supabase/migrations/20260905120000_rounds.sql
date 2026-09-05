ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 1;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 1;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS result_ms int;
