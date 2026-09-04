import { useEffect, useState } from "react";

export function QrControl({
  value,
  number,
  size = 260,
}: {
  value: string;
  number: number;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(value, { width: size, margin: 1 });
      if (active) setSrc(url);
    })();
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div className="surface-card flex break-inside-avoid flex-col items-center gap-3 p-5">
      <div className="flex w-full items-center justify-between">
        <span className="font-display text-3xl leading-none text-primary">
          Kontroll {number}
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          #{String(number).padStart(2, "0")}
        </span>
      </div>
      <div className="flex aspect-square w-full max-w-[260px] items-center justify-center rounded-lg bg-card">
        {src ? (
          <img src={src} alt={`Streckkod för kontroll ${number}`} className="h-full w-full" />
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Sätt upp vid kontrollpunkt {number}
      </p>
    </div>
  );
}
