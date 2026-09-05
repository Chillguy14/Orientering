ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS ordered boolean NOT NULL DEFAULT false;
