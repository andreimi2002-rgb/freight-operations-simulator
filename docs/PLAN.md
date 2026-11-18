# Plan de dezvoltare (v1.1)

Bazat pe *TruckSim Command Center Master Plan v1* (18.11.2026), cu modificările discutate. Regulile de bază rămân: date reale înainte de efecte, `null` în loc de 0, fără indicații inventate, iar fiecare valoare își arată sursa (LIVE / DEMO / REPLAY / date vechi).

## Faze

| # | Fază | Stare | „Gata” înseamnă |
| --- | --- | --- | --- |
| 0 | Monorepo, schemă comună, design system Apple, PWA, demo, **recorder + replay** | ✅ implementat | PWA pe iPhone/iPad; demo și live clar separate |
| 1 | Bridge live (memorie partajată), WebSocket, reconectare, stări de eroare, token | ✅ implementat, **de validat pe joc** | viteza și cursa se actualizează pe telefon în timpul jocului |
| 2 | Dashboard: Camion, Cursă, alerte proactive (combustibil, odihnă, viteză, amenzi) | ✅ implementat, de validat | cursa Subse → Ruse apare cu date reale |
| 3 | Copilot: text + push-to-talk, unelte read-only, Claude sau reguli locale | ✅ implementat | răspunde corect la stare și refuză valorile indisponibile |
| 4 | Carieră (SQLite, o înregistrare per livrare) + Wiki ATS | ✅ implementat | cel puțin o cursă reală verificată |
| 5 | **Map Data Pipeline**: extragere drumuri, prefab-uri și orașe din fișierele `.scs`, proiecție, randare | ⏭ următoarea | camionul urmărește drumul fără offset vizibil |
| 6 | Rutare proprie spre compania destinatară + recalculare | ⏳ | ruta coincide cu cea din joc pe 5 curse test |
| 7 | Smart Highway: manevre → indicatoare → benzi, doar acolo unde datele o dovedesc | ⏳ | ieșiri testate; fără benzi inventate |
| 8 | Wiki ETS2 din definițiile jocului; carieră din salvări (`game.sii`) | ⏳ | — |
| 9 | Overlay PC, export CSV/JSON, rafinare | ⏳ | — |

## Decizii (jurnal)

- **2026-11-18**: repo-ul `freight-operations-simulator` (și site-ul Netlify) este refolosit. Freight World e salvat ca tag-ul `freight-world-final`, iar datele ATS (`data/ats`, `data/map`) se păstrează pentru Wiki.
- **2026-11-18**: bridge-ul folosește pluginul RenCloud (deja instalat în ambele jocuri), citit direct prin `koffi` + `kernel32`. Nu are nevoie de compilator, .NET sau alt server.
- **2026-11-18**: TypeScript rulat direct de Node (type stripping), deci fără pas de build pe server. SQLite prin `node:sqlite` (inclus în Node).
- **2026-11-18**: harta din faza 0–4 arată doar ce e sigur: poziția, direcția și traseul parcurs. Drumurile vin din Map Data Pipeline, nu din presupuneri.
- **2026-11-18**: copilotul folosește Claude (`claude-opus-5-5`, effort `low`) când există o cheie pe PC. Altfel folosește reguli locale în română, care merg offline și în browser.
- **2026-11-18**: design în stil Apple Maps premium: materiale translucide, fontul sistemului, banner verde de navigație, card ETA, mod Night Drive.

## Surse pentru Map Data Pipeline (de evaluat licențele)

- `truckermudgeon/maps`: pipeline TypeScript de extragere a hărților ETS2/ATS + rutare.
- `dariowouters/ts-map`: parser C# de sectoare și prefab-uri.
- Documentația SCS pentru formatul `.scs` (HashFS).
