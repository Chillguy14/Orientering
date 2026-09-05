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
  restartSession,
  saveHostedRound,
  sessionTitle,
  type ControlRow,
  type ParticipantRow,
  type PunchRow,
  type SessionRow,
} from "@/lib/orienteering";

export const Route = createFileRoute("/host/$code")({
  head: () => ({
    meta: [
      { title: "Arrangör – Orientering" },
      {
        name: "description",
        content: "Skriv ut kontrollernas streckkoder, dela koden och starta omgången.",
      },
      { property: "og:title", content: "Arrangör – Orientering" },
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const s = await getSessionByCode(code);
      if (!active) return;
      setSession(s);
      if (s) {
        saveHostedRound(s);
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
    const refresh = async () => {
      const p = await getParticipants(session.id);
      setParticipants(p);
      setPunches(await getPunches(p.map((x) => x.id)));
    };
    const channel = supabase
      .channel(`host-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "punches" }, () => {
        void refresh();
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

  async function runAgain() {
    if (!session) return;
    const ok = window.confirm(
      "Köra rundan igen? Samma kontroller och QR-koder används. Nuvarande deltagare sparas under tidigare omgångar.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await restartSession(session);
      setSession(updated);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <CenteredMessage text="Laddar omgången..." />;
  }
  if (!session) {
    return <CenteredMessage text="Hittade ingen omgång med den koden." />;
  }

  const started = session.status !== "lobby";
  const current = participants.filter((p) => p.round === session.round);
  const previousRounds = Array.from(
    new Set(participants.filter((p) => p.round !== session.round).map((p) => p.round)),
  ).sort((a, b) => b - a);

  function punchesFor(p: ParticipantRow) {
    return punches.filter((x) => x.participant_id === p.id);
  }

  function resultFor(p: ParticipantRow): string | null {
    if (p.result_ms != null) return formatDuration(p.result_ms);
    const mine = punchesFor(p);
    const done = controls.length > 0 && mine.length >= controls.length;
    if (!done || !session?.started_at || p.round !== session.round) return null;
    const last = mine.map((x) => x.punched_at).sort().at(-1)!;
    return formatDuration(new Date(last).getTime() - new Date(session.started_at).getTime());
  }

  return (
    <main className="min-h-screen bg-background pb-20">
      <header className="forest-panel px-5 py-10 print:hidden">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <Link to="/" className="text-sm opacity-80 underline-offset-4 hover:underline">
            ← Till startsidan
          </Link>
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] uppercase opacity-80">
              {sessionTitle(session)} · omgång {session.round}
            </p>
            <p className="font-display text-7xl leading-none tracking-[0.15em]">{session.code}</p>
            <p className="mt-2 text-sm opacity-90">
              {session.control_count} kontroller · {current.length} deltagare ·{" "}
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
            {started ? (
              <button
                onClick={() => void runAgain()}
                disabled={busy}
                className="rounded-xl bg-primary-foreground/15 px-6 py-3 font-display text-2xl disabled:opacity-60"
              >
                {busy ? "Nollställer..." : "Kör igen"}
              </button>
            ) : null}
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
        <p className="hidden font-display text-2xl print:block">
          {sessionTitle(session)} – kod {session.code}
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {controls.map((c) => (
            <QrControl key={c.id} number={c.number} value={controlPayload(session.code, c.token)} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pt-12 print:hidden">
        <h2 className="text-3xl text-primary">Deltagare · omgång {session.round}</h2>
        {current.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ingen har gått med än. Dela koden {session.code}.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {current.map((p) => {
              const taken = punchesFor(p).length;
              const done = taken >= controls.length && controls.length > 0;
              const result = resultFor(p);
              return (
                <li key={p.id} className="surface-card flex items-center justify-between p-4">
                  <div>
                    <p className="font-display text-2xl text-foreground">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {taken} av {controls.length} kontroller
                      {result ? ` · klar på ${result}` : ""}
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

      {previousRounds.length > 0 ? (
        <section className="mx-auto max-w-4xl px-5 pt-12 print:hidden">
          <h2 className="text-3xl text-primary">Tidigare omgångar</h2>
          <div className="mt-4 space-y-6">
            {previousRounds.map((round) => {
              const list = participants
                .filter((p) => p.round === round)
                .sort((a, b) => {
                  const ra = a.result_ms ?? Number.MAX_SAFE_INTEGER;
                  const rb = b.result_ms ?? Number.MAX_SAFE_INTEGER;
                  return ra - rb;
                });
              return (
                <div key={round}>
                  <h3 className="text-xl text-muted-foreground">Omgång {round}</h3>
                  <ul className="mt-2 space-y-2">
                    {list.map((p, i) => {
                      const taken = punchesFor(p).length;
                      const result = resultFor(p);
                      return (
                        <li
                          key={p.id}
                          className="surface-card flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-sm text-muted-foreground">
                              {result ? `${i + 1}.` : ""}
                            </span>
                            <div>
                              <p className="font-display text-xl text-foreground">{p.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {taken} av {controls.length} kontroller
                              </p>
                            </div>
                          </div>
                          <span className="font-display text-xl text-foreground">
                            {result ?? "–"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
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
