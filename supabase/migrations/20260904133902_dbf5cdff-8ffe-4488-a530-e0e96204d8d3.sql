CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  control_count int NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'lobby',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.sessions TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions readable" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "sessions insertable" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "sessions updatable" ON public.sessions FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  number int NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, number)
);
GRANT SELECT, INSERT ON public.controls TO anon, authenticated;
GRANT ALL ON public.controls TO service_role;
ALTER TABLE public.controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "controls readable" ON public.controls FOR SELECT USING (true);
CREATE POLICY "controls insertable" ON public.controls FOR INSERT WITH CHECK (true);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.participants TO anon, authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants readable" ON public.participants FOR SELECT USING (true);
CREATE POLICY "participants insertable" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "participants updatable" ON public.participants FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES public.controls(id) ON DELETE CASCADE,
  punched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, control_id)
);
GRANT SELECT, INSERT ON public.punches TO anon, authenticated;
GRANT ALL ON public.punches TO service_role;
ALTER TABLE public.punches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "punches readable" ON public.punches FOR SELECT USING (true);
CREATE POLICY "punches insertable" ON public.punches FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.punches;