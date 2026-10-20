# V1 · Etapa 1D — Fotografii și vreme pentru orașe (un singur PR)

Stare: implementat, în revizie. Acoperire foto: 225 din 270 de orașe (RO 97/126, HU 76/89, BG 52/55). Branch: `feature/v1-phase1d` (din `main`, după PR #7).
Decizii (recomandările asistentului, acceptate de proprietar): cardurile orașelor în „Prezentare” și „Hartă și rută”, hero-ul rămâne fără fotografie; aceleași licențe ca în Airport Live (inclusiv Free Art License); pozele se încarcă de pe Wikimedia; vreme doar pentru origine și destinație; acum + 3 zile + la ferestre; °C, km/h, mm; MET Norway.

## A. Fotografii (date pregătite offline)
- `scripts/build-city-photos.mjs [CC …]` (implicit țările active): ID GeoNames → element Wikidata (P1566) → imaginea P18 (rangul preferat întâi, fără cele depreciate) sau bannerul Wikivoyage P948 → informațiile Commons (autor, licență, dimensiuni, pagină). Mai multe elemente Wikidata pentru același ID → orașul se sare (nu se ghicește).
- Filtre: doar fotografii (JPEG/PNG/WebP), cel puțin 640 px lățime, licență acceptată, autor cunoscut (sau domeniu public), fără hărți/steme/steaguri/colaje după numele fișierului, linkul miniaturii verificat.
- Ieșire: `src/data/photos/cities-<CC>.json` (calea în `src/data/countries.mjs`), cu autor, licență, link de licență, pagina fișierului, sursa (P18/P948) și data verificării.
- UI: carduri Origine / Destinație cu poza, numele, țara, populația și creditul (autor · licență · Wikimedia Commons, cu linkuri); fallback stilizat (gradient + codul orașului) dacă lipsește sau nu se încarcă.

## B. Vreme (funcție live)
- `netlify/lib/weather/`: apel MET Norway (User-Agent cu link de contact, timeout), normalizare: acum, 3 zile locale (min/max/stare/precipitații), serie orară compactă pentru 7 zile; stările cerului reduse la 8 categorii neutre ca limbă (senin, parțial noros, noros, ceață, ploaie, lapoviță, ninsoare, furtună) + intensitate.
- `netlify/functions/weather.mjs` la `/api/weather/:id`: validează ID-ul, caută orașul în `src/data/places/lookup.json` (generat de importator pentru țările active), răspunde cu antete de cache CDN și limită de cereri; erorile furnizorului dau un răspuns clar, nu date inventate.
- Client: `src/adapters/weather-client.mjs` (cerere + cache pe sesiune), `src/view-model/weather.mjs` (texte și valorile la ferestrele cursei: intrarea orară cea mai apropiată, max. 3 h distanță, altfel „indisponibil”).
- UI: banda de vreme pe cardul orașului (acum, 3 zile, la fereastră), stări: se încarcă / eroare / actualizat la HH:MM; click → drawer cu sursa, licența, ora preluării.

## Teste
Fișierele de poze (autor, licență acceptată, URL Wikimedia, ID existent în catalog), helperii de licență și selecție; normalizarea MET pe un fixture marcat, zilele în fusul orar al orașului, categoriile, alegerea orei pentru ferestre, răspunsurile funcției (400/404/502/200 și antetele de cache); `lookup.json` în acord cu fișierele de orașe; browser: carduri cu și fără poză, vreme încărcată / eroare, telefon fără scroll lateral, print neschimbat. Verificare reală: MET Norway și Wikimedia apelate de pe calculatorul asistentului.
