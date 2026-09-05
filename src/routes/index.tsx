import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createSession,
  getSessionByCode,
  listHostedRounds,
  removeHostedRound,
  type HostedRound,
} from "@/lib/orienteering";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orientering" },
      {
        name: "description",
        content:
          "Starta en orienteringsomgång, skriv ut QR-kontroller och låt alla deltagare stämpla av kontrollerna med mobilen.",
      },
      { property: "og:title", content: "Orientering" },
      {
        property: "og:description",
        content:
          "Skapa en omgång, sätt upp streckkoder i skogen och följ deltagarnas stämplingar live.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"start" | "setup">("start");
  const [count, setCount] = useState(6);
  const [roundName, setRoundName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hosted, setHosted] = useState<HostedRound[]>([]);

  useEffect(() => {
    setHosted(listHostedRounds());
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const session = await createSession(Math.min(30, Math.max(1, count)), roundName);
      void navigate({ to: "/host/$code", params: { code: session.code } });
    } catch {
      setError("Kunde inte skapa omgången. Försök igen.");
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    try {
      const session = await getSessionByCode(code);
      if (!session) {
        setError("Hittade ingen omgång med den koden.");
        setBusy(false);
        return;
      }
      void navigate({ to: "/run/$code", params: { code: session.code } });
    } catch {
      setError("Något gick fel. Försök igen.");
      setBusy(false);
    }
  }

  function forget(code: string) {
    removeHostedRound(code);
    setHosted(listHostedRounds());
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="forest-panel px-5 pt-14 pb-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.3em] uppercase opacity-80">
            Orientering
          </p>
          <h1 className="mt-3 text-5xl leading-[0.95] font-bold sm:text-7xl">
            Sätt upp kontroller.
            <br />
            Skanna. Spring.
          </h1>
          <p className="mt-5 max-w-xl text-base opacity-90">
            Skapa en omgång, få ut färdiga streckkoder att hänga upp i skogen och dela en kod så
            att alla kan vara med. Varje skanning checkar av kontrollen automatiskt.
          </p>
        </div>
      </section>

      <section className="mx-auto -mt-12 max-w-3xl px-5 pb-16">
        <div className="surface-card p-6 sm:p-8">
          {step === "start" ? (
            <button
              onClick={() => setStep("setup")}
              className="w-full rounded-xl bg-accent px-6 py-5 font-display text-3xl text-accent-foreground transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              Starta ny omgång
            </button>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl text-primary">Ny runda</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ge rundan ett namn och välj antal kontroller (1–30).
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-muted-foreground" htmlFor="roundName">
                  Namn på rundan
                </label>
                <input
                  id="roundName"
                  value={roundName}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder="T.ex. Skolskogen, 6 kontroller"
                  maxLength={60}
                  className="mt-2 h-14 w-full rounded-xl border border-input bg-background px-4 text-lg text-foreground"
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground">Antal kontroller</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => setCount((c) => Math.max(1, c - 1))}
                    className="h-14 w-14 rounded-xl border border-border font-display text-2xl text-primary"
                    aria-label="Färre kontroller"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="h-14 w-full rounded-xl border border-input bg-background text-center font-display text-3xl text-foreground"
                  />
                  <button
                    onClick={() => setCount((c) => Math.min(30, c + 1))}
                    className="h-14 w-14 rounded-xl border border-border font-display text-2xl text-primary"
                    aria-label="Fler kontroller"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                disabled={busy}
                onClick={() => void handleCreate()}
                className="w-full rounded-xl bg-primary px-6 py-4 font-display text-2xl text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Genererar..." : "Skapa rundan"}
              </button>
            </div>
          )}

          <form onSubmit={(e) => void handleJoin(e)} className="mt-8 border-t border-border pt-6">
            <label className="text-sm font-semibold text-muted-foreground" htmlFor="joinCode">
              Har du en kod? Gå med i omgången
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="joinCode"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="T.ex. K7M2X"
                className="h-14 w-full rounded-xl border border-input bg-background px-4 text-center font-display text-2xl tracking-[0.3em] text-foreground"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-14 shrink-0 rounded-xl bg-secondary px-6 font-display text-xl text-secondary-foreground disabled:opacity-60"
              >
                Gå med
              </button>
            </div>
          </form>

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>

        {hosted.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-3xl text-primary">Dina rundor</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rundor du skapat i den här webbläsaren. Öppna en för att köra den igen med samma
              QR-koder.
            </p>
            <ul className="mt-4 space-y-3">
              {hosted.map((r) => (
                <li key={r.code} className="surface-card flex items-center justify-between gap-3 p-4">
                  <Link to="/host/$code" params={{ code: r.code }} className="min-w-0 flex-1">
                    <p className="truncate font-display text-2xl text-foreground">
                      {r.name?.trim() || `Omgång ${r.code}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Kod {r.code} · {r.controlCount} kontroller ·{" "}
                      {new Date(r.createdAt).toLocaleDateString("sv-SE")}
                    </p>
                  </Link>
                  <Link
                    to="/host/$code"
                    params={{ code: r.code }}
                    className="shrink-0 rounded-xl bg-primary px-4 py-2 font-display text-lg text-primary-foreground"
                  >
                    Öppna
                  </Link>
                  <button
                    onClick={() => forget(r.code)}
                    className="shrink-0 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground"
                    aria-label="Ta bort från listan"
                    title="Ta bort från listan"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
