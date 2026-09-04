import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrControl } from "@/components/QrControl";
import {
  controlPayload,
  formatDuration,
  getControls,
  getParticipants,
  getPunches,
  getSessionByCode,
  type ControlRow,
  type ParticipantRow,
  type PunchRow,
  type SessionRow,
} from "@/lib/orienteering";

export const Route = createFileRoute("/host/$code")({
  head: () => ({
    meta: [
      { title: "Arrangör – Kontrollen" },
      {
        name: "description",
        content: "Skriv ut kontrollernas streckkoder, dela koden och starta omgången.",
      },
      { property: "og:title", content: "Arrangör – Kontrollen" },
      {
        property: "og:description",
        content: "Skriv ut kontrollernas streckkoder, dela koden och starta omgången.",
      },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const s = await getSessionByCode(code);
      if (!active) return;
      setSession(s);
      if (s) {
        setControls(await getControls(s.id));
        const p = await getParticipants(s.id);
        setParticipants(p);
        setPunches(await getPunches(p.map((x) => x.id)));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`host-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => {
        void (async () => {
          const p = await getParticipants(session.id);
          setParticipants(p);
          setPunches(await getPunches(p.map((x) => x.id)));
        })();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "punches" }, () => {
        void (async () => {
          const p = await getParticipants(session.id);
          setPunches(await getPunches(p.map((x) => x.id)));
        })();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session]);

  async function startRound() {
    if (!session) return;
    const { data } = await supabase
      .from("sessions")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", session.id)
      .select()
      .single();
    if (data) setSession(data as SessionRow);
  }

  if (loading) {
    return <CenteredMessage text="Laddar omgången..." />;
  }
  if (!session) {
    return <CenteredMessage text="Hittade ingen omgång med den koden." />;
  }

  const started = session.status !== "lobby";

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="forest-panel px-5 py-10 print:hidden">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <Link to="/" className="text-sm opacity-80 underline-offset-4 hover:underline">
            ← Till startsidan
          </Link>
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] uppercase opacity-80">
              Kod att dela
            </p>
            <p className="font-display text-7xl leading-none tracking-[0.15em]">{session.code}</p>
            <p className="mt-2 text-sm opacity-90">
              {session.control_count} kontroller · {participants.length} deltagare ·{" "}
              {started ? "omgången är igång" : "väntar på start"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void startRound()}
              disabled={started}
              className="rounded-xl bg-accent px-6 py-3 font-display text-2xl text-accent-foreground disabled:opacity-60"
            >
              {started ? "Omgången är startad" : "Starta omgången"}
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl border border-primary-foreground/40 px-6 py-3 font-display text-2xl"
            >
              Skriv ut kontroller
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 pt-10">
        <h2 className="text-3xl text-primary print:hidden">Kontrollernas streckkoder</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {controls.map((c) => (
            <QrControl key={c.id} number={c.number} value={controlPayload(session.code, c.token)} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pt-12 print:hidden">
        <h2 className="text-3xl text-primary">Deltagare</h2>
        {participants.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ingen har gått med än. Dela koden {session.code}.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {participants.map((p) => {
              const taken = punches.filter((x) => x.participant_id === p.id).length;
              const done = taken >= controls.length && controls.length > 0;
              return (
                <li key={p.id} className="surface-card flex items-center justify-between p-4">
                  <div>
                    <p className="font-display text-2xl text-foreground">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {taken} av {controls.length} kontroller
                      {done && session.started_at
                        ? ` · klar på ${formatDuration(
                            new Date(
                              punches
                                .filter((x) => x.participant_id === p.id)
                                .map((x) => x.punched_at)
                                .sort()
                                .at(-1)!,
                            ).getTime() - new Date(session.started_at).getTime(),
                          )}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      done
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {done ? "I mål" : "Ute"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <p className="text-lg text-muted-foreground">{text}</p>
    </main>
  );
}
