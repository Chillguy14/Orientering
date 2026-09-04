# Plan: Orange/vitt tema + verifiera utskriftsknappen

## Utskriftsknappen – funkar den?
Ja, knappen är korrekt implementerad: den kör `window.print()` och sidan har redan `print:hidden` på rubrikdelen, deltagarlistan och övrig navigering, så att utskriften bara visar streckkoderna. En förbättring görs ändå: tydliga utskriftsstilar (vita kort, svarta kanter vid utskrift) så att QR-koderna alltid blir skarpa och läsbara på papper.

## Nytt tema: orange och vitt
Ändra hela färgschemat i `src/styles.css` från grön/orange till orange/vitt:

- **Bakgrund:** ren vit / varmvit
- **Text:** mörk, nästan svart (behåller läsbarhet)
- **Primär:** stark orange (ersätter dagens gröna)
- **Accent:** orange (behålls som idag)
- **Panelgradient (`forest-panel`):** orange gradient istället för grön – används i sidhuvudena
- **Kort, kanter, sekundära ytor:** vita/ljusa med subtil orange ton
- Byt även namn på gradienten (`--gradient-forest` → `--gradient-brand`) eller behåll namnet men ändra färgerna, beroende på vad som är enklast utan att röra komponenterna för mycket.

Typsnitten (Barlow Condensed + Manrope) och layouten ändras inte.

## Berörda filer
- `src/styles.css` – nya färgvärden i `:root`
- `src/routes/host.$code.tsx` – ev. utskriftsstilar för QR-korten
- `src/components/QrControl.tsx` – säkerställa bra utskrift (svart kod på vit bakgrund)

## Verifiering
- Köra Playwright: skapa omgång, öppna arrangörssidan, testa utskriftsknappen (kontrollera att utskriftsdialogen/print-vyn triggar och att QR-koderna syns i utskriftsläget) och ta skärmdumpar av det nya orange/vita temat på startsidan, arrangörssidan och löparsidan.
