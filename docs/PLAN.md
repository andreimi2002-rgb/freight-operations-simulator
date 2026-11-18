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
| 4b | **Game Data Pipeline**: cititor de arhive `.scs` (HashFS v1/v2, ZIP), parser SII, extragere țări, orașe, companii (depozite, mărfuri), mărfuri, cu nume în română; Wiki ETS2 + ATS complet | ✅ implementat | Subse / Brașov → Ruse / ciocolată găsite în datele extrase (test automat) |
| 5 | **Map Data Pipeline**: drumuri, prefab-uri și orașe din sectoarele hărții (`base_map.scs` + DLC), proiecție, randare | ⏭ următoarea | camionul urmărește drumul fără offset vizibil |
| 6 | Rutare proprie spre compania destinatară + recalculare | ⏳ | ruta coincide cu cea din joc pe 5 curse test |
| 7 | Smart Highway: manevre → indicatoare → benzi, doar acolo unde datele o dovedesc | ⏳ | ieșiri testate; fără benzi inventate |
| 8 | Carieră din salvări (`game.sii`), camioane și remorci ETS2 în Wiki | ⏳ | — |
| 9 | Overlay PC, export CSV/JSON, rafinare | ⏳ | — |

## Decizii (jurnal)

- **2026-11-18**: repo-ul `freight-operations-simulator` (și site-ul Netlify) este refolosit. Freight World e salvat ca tag-ul `freight-world-final`, iar datele ATS (`data/ats`, `data/map`) se păstrează pentru Wiki.
- **2026-11-18**: bridge-ul folosește pluginul RenCloud (deja instalat în ambele jocuri), citit direct prin `koffi` + `kernel32`. Nu are nevoie de compilator, .NET sau alt server.
- **2026-11-18**: TypeScript rulat direct de Node (type stripping), deci fără pas de build pe server. SQLite prin `node:sqlite` (inclus în Node).
- **2026-11-18**: harta din faza 0–4 arată doar ce e sigur: poziția, direcția și traseul parcurs. Drumurile vin din Map Data Pipeline, nu din presupuneri.
- **2026-11-18**: copilotul folosește Claude (`claude-opus-5-5`, effort `low`) când există o cheie pe PC. Altfel folosește reguli locale în română, care merg offline și în browser.
- **2026-11-18**: design în stil Apple Maps premium: materiale translucide, fontul sistemului, banner verde de navigație, card ETA, mod Night Drive.
- **2026-11-18**: copilotul suportă Gemini (gratuit, implicit), Claude și reguli locale; cheia se configurează din aplicație și stă doar pe PC (`var/ai.json`).
- **2026-11-18**: împerechere cu cod de 6 cifre afișat în fereastra bridge-ului (aplicația de pe ecranul iPhone nu împarte memoria cu Safari).
- **2026-11-18**: datele extrase din joc (`data/generated/`) **nu se urcă pe GitHub** (repo public, conținut SCS). Bridge-ul le extrage la pornire, din instalarea locală, doar când jocul s-a schimbat (~2 s), și le servește aplicației prin `/api/gamedata/<joc>`. Cititorul de arhive e scris de noi; CityHash e portat din ts-map (MIT, cu atribuire). Codul GPL (TruckLib, Extractor, truckermudgeon/maps) nu e copiat.

- **2026-11-18**: remorcile date de companii la cursă (`def/vehicle/trailer/`, de ex. `schw_curtain`) vin în telemetrie cu marcă și nume goale; le identificăm prin `trailer_definition` din fișierele jocului (aliasuri extrase automat; 100 din 102 în ETS2 se leagă de o fișă Wiki). Confirmat pe înregistrarea reală de la 14:40.
- **2026-11-18**: numele orașelor afișate vin din Wiki (traduse), nu din telemetrie, care trimite grafia locală (de ex. „Русе”).

- **2026-11-18**: harta întregii Europe ETS2: toate cele 1.101 sectoare (bază + DLC-uri), construite într-un worker la pornirea bridge-ului (~12 s, doar când jocul s-a schimbat) în `data/generated/map/ets2/`: 288 de zone de 8 km, un strat simplificat pentru vederea de ansamblu și un graf de rutare (194k noduri, 341k legături). Aplicația încarcă zonele din jurul camionului (5×5). Rutare A* pe toată harta: 12/13 coridoare de test găsite în 2–27 ms; UK, Sicilia, Sardinia, Corsica și insulele grecești cer feriboturi, care nu sunt încă în graf.
- **2026-11-18**: câmpurile de la +69/+77 ale drumurilor sunt suprascrieri pe sens, nu sensuri închise; ignorarea lor a dus rețeaua conectată de la 74% la 93%. Drumurile cu flag `0x02000000` rămân excluse (sunt în mare parte bucăți izolate).
- **2026-11-18**: pe înregistrările reale Brașov → Ruse, traseul condus stă pe ruta aplicației (abatere mediană 2–3 m). Lungimea rutei ×19 e cu 16–20% peste distanța GPS a jocului (probabil scara 1:3 din orașe și ținta „centrul orașului” în loc de depozit); în UI distanța rămâne cea din joc.

## Surse pentru Map Data Pipeline

- `dariowouters/ts-map` (MIT): referință pentru formatul sectoarelor de hartă și al prefab-urilor; se poate porta cu atribuire.
- `truckermudgeon/maps`, `sk-zk/TruckLib` (GPL): doar ca documentație de format, fără cod copiat.
