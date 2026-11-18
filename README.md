# TruckSim Command Center

Companion personal pentru **Euro Truck Simulator 2** și **American Truck Simulator**: telemetrie live pe iPhone/iPad/PC, hartă în stil Apple Maps, copilot în română (text și voce), enciclopedie și jurnal de curse.

Proiect personal, neafiliat cu SCS Software.

```
ETS2 / ATS ──► scs-telemetry.dll (plugin) ──► memorie partajată "Local\SCSTelemetry"
                                                    │
                                    apps/bridge (Node, pe PC-ul cu jocul)
                                    · citește 20×/s, normalizează, detectează evenimente
                                    · jurnal de curse (SQLite) · înregistrări (replay)
                                    · copilot (Claude sau reguli locale)
                                                    │  WebSocket + REST, cu token
                                                    ▼
                         apps/web (PWA React) ── Netlify sau servită chiar de bridge
                         Hartă · Cursă · Camion · Copilot · Wiki · Carieră · Setări
```

## Pornire rapidă

Ai nevoie de Node 24+ (pe PC e instalat Node 26).

```bash
npm install
```

```bash
npm run build
```

```bash
npm run bridge
```

Bridge-ul afișează adresa, tokenul și un **link de împerechere**. Deschide link-ul pe telefon (aceeași rețea Wi-Fi) și aplicația se conectează singură.

- Fără joc: `npm run bridge:demo` rulează cursa demo Brașov → Ruse prin bridge.
- Doar interfața, fără PC: deschide aplicația de pe Netlify. Pornește automat în modul demo, care rulează în browser.
- Dezvoltare UI: `npm run dev` (Vite, http://localhost:5173).

Pentru microfon și pentru aplicația de pe Netlify ai nevoie de HTTPS până la PC. Pașii sunt în [docs/SETUP.md](docs/SETUP.md).

## Structură

| Folder | Ce conține |
| --- | --- |
| `packages/core` | Schema comună (`Snapshot`, `Trip`, `GameEvent`), detecție evenimente, jurnal de curse, simulator demo, copilot local + unelte, căutare wiki, formatare unități. Rulează în Node și în browser. |
| `apps/bridge` | Serviciul Windows: citire memorie partajată (koffi → kernel32), normalizare, WebSocket/REST, SQLite (`node:sqlite`), înregistrări `.jsonl.gz`, Claude. |
| `apps/web` | PWA React + Vite: design Apple, hartă canvas cu vedere 3D, voce (Web Speech API). |
| `data/ats` | Date ATS din Truck Simulator Wiki (CC BY-SA 4.0), moștenite din Freight World. |
| `recordings/` | Sesiuni live înregistrate automat (ignorate de git), pentru replay și teste. |
| `docs/` | Plan, instalare, validare pe jocul real. |

## Verificare

```bash
npm run check
```

Rulează typecheck pe toate pachetele și testele (`node --test`): parser-ul memoriei pluginului pe offset-urile documentate, normalizare, evenimente, „cursa se salvează o singură dată”, copilotul care refuză să inventeze, căutare wiki.

## Copilot AI

Fără cheie, copilotul răspunde cu reguli locale în română, doar despre joc: distanță, combustibil, cursă, camion, odihnă, istoric, wiki.

Cu un AI conectat devine un asistent general, care răspunde la orice. Cifrele din joc le ia tot doar din telemetrie. Se configurează din **Setări → Copilot AI**, fără terminal și fără repornire.

| Furnizor | Cost | Cheie |
| --- | --- | --- |
| **Gemini** (recomandat) | gratuit, cu limite de cereri | aistudio.google.com/apikey: **Create API key → într-un proiect nou, fără facturare** |
| Claude | plătit la folosire | console.anthropic.com → API Keys |
| Local | gratuit, offline | nu e nevoie |

Important pentru Gemini: o cheie dintr-un proiect Google cu facturare activă (de exemplu cu plată anticipată și credit zero) nu primește nivelul gratuit și dă eroarea 402. Folosește un proiect nou, fără facturare.

La salvare, aplicația trimite un mesaj de test minim, alege automat cel mai bun model care răspunde și abia apoi salvează cheia, doar pe PC, în `var/ai.json` (ignorat de git). Cheia nu ajunge în browser. Cel mai sigur e s-o introduci de pe PC (`http://localhost:<port>`) sau prin HTTPS (Tailscale), nu prin HTTP pe Wi-Fi.

Alternativ, merg și variabilele de mediu `GEMINI_API_KEY` sau `ANTHROPIC_API_KEY`. O cheie salvată din aplicație are prioritate.

## Istoric

Branch-ul `main` conținea **Freight World** (generator de curse ATS), salvat ca tag-ul `freight-world-final`. Proiectul de dinainte (FOS) e tag-ul `fos-final`.
