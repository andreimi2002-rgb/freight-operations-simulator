# V1 · Etapa 1A — Plan de redesign

Stare: **de aprobat** (nimic din acest plan nu e implementat încă).
Branch: `feature/v1-real-world` (pornit din `origin/main`, commit `8a7f952`).
Motorul (`src/mission-engine.mjs`, cataloagele, funcțiile Netlify de rutare) rămâne neschimbat, cu o singură excepție: scoatem apelul la harta statică Geoapify din `truck-route.mjs`.

## 1. Ce am găsit în cod (și schimbă lucrurile)

1. **Cele 9 coridoare curate nu ating RO/HU/BG.** Sunt Seattle–LA, Chicago–Detroit, Rotterdam–Duisburg, Valencia–Madrid etc. După filtrarea la RO/HU/BG nu mai rămâne niciunul. În 1A cursele se generează deci doar ca perechi aleatorii din cele **120 de orașe GeoNames** RO/HU/BG (40 pe țară; toate au `worlds: ["ETS2"]`). Coridoarele și directorul de companii (Dole, Walmart, Scania…) dispar din interfață; fișierele rămân în repo până în etapa 2.
2. **Temperatura din catalog e text, nu cifre** (`"product-specific"`). Nu există nicio valoare numerică în date. Rândul „Temperatură” rămâne „Indisponibil încă — Etapa 3”.
3. **Marfa nu are cod NST.** Are doar `family` (grupare FOS, ex. „Agriculture & food”). Capitolul NST îl propun ca **estimat** (vezi §5).
4. **Textele din catalog sunt în engleză** (nume de mărfuri, familii, trailere, note de manipulare: ~37 KB). Vezi decizia de la §9.
5. **Geoapify returnează `namedRoads`** (drumuri, cu distanțe) și `countries`. Nu returnează orașe pe traseu și nu numește punctul de frontieră. De aici: linia „via” = cele mai lungi 3 drumuri (din sursă), iar frontiera = doar țările tranzitate.
6. **Printul actual deschide o fereastră pop-up** (`window.open`), care pe telefon e adesea blocată. Îl înlocuiesc cu `window.print()` pe aceeași pagină, cu stil `@media print`.
7. **ID-ul misiunii conține lumea** (`FOS-ETS2-2026-XXXXX`). Afișez `FOS-2026-XXXXX`; valoarea stocată nu se schimbă.

## 2. Ce am rulat până acum (toate comenzile)

```
git config --global --add safe.directory C:/Users/stroe/Downloads/freight-operations-simulator
git fetch origin
git checkout -B feature/v1-real-world origin/main
icacls index.html            # doar citire, pentru a vedea drepturile
```

Nu am schimbat nicio permisiune: în repo-ul real `stroe` are control total pe toate fișierele. Fișierele „blocate” erau doar în copia din zip (`freight-operations-simulator-main\freight-operations-simulator-main`, fără `.git`). **Deschide în VS Code folderul `C:\Users\stroe\Downloads\freight-operations-simulator`**, nu copia din zip.

## 3. Ce preiau din Airport Live

| Din Airport Live (`public/`) | În FOS | Ce fac cu el |
|---|---|---|
| `fonts/*.woff2` (4) + `LICENSE-*.txt` (2) | `fonts/` | copiate identic |
| `styles.css` | `src/styles.css` (rescris) | iau `@font-face`, `:root`, bara de sus, hero, KPI, rânduri „board”, drawer, paletă, responsive, `prefers-reduced-motion`; adaug culorile și stilul de proveniență și `@media print` |
| `index.html` | `index.html` (rescris) | structura: bara de sus, hero, glance, secțiuni, drawer, paletă |
| `js/search-ui.js` | `src/ui/palette.mjs` | tastatura (/, Ctrl+K, săgeți, Enter, Esc, focus înapoi); rezultatele vin din cele 120 de orașe, nu din aeroporturi |
| drawer-ul din `js/app.js` | `src/ui/drawer.mjs` | deschidere/închidere, backdrop, Esc |

Nu iau: grafice, logo-uri, poze, meteo, zboruri, panoul de perete. Nu mai e nevoie de `design-reference/`: citesc direct din folderul Airport Live. Ținta vizuală e `fos-redesign-demo.dc.html` (doar ca machetă; îl copiez în `docs/design/` ca referință).

## 4. Structura codului (fără build, module ES în browser)

```
index.html                    # shell: bara de sus, hero, glance, KPI, fișa, drawer, paletă
fonts/                        # Inter + JetBrains Mono + licențe
src/
  styles.css                  # tokenuri + componente + print
  i18n/ro.json                # TOATE textele interfeței
  i18n/i18n.mjs               # t(key, params), format*, locale "ro-RO" (Intl)
  view-model/provenance.mjs   # nivelurile + etichetele + "indisponibil"
  view-model/load-sheet.mjs   # buildLoadSheet(misiune) -> fișa (SINGURA funcție de conversie)
  data/city-codes.mjs         # coduri de 3 litere pentru orașe (temporar, până la UN/LOCODE)
  ui/                         # topbar, hero, glance, kpis, load-sheet-view, drawer, palette, generator, about, print
  map/route-map.mjs           # MapLibre + OpenFreeMap
  main.js                     # orchestrare: stare, istoric, generare
```

- **Regulă (punctul 5 din mesajul tău):** toată interfața citește doar rezultatul lui `buildLoadSheet(mission)`. Niciun modul din `ui/` nu atinge `mission` direct. În 1B se schimbă doar `buildLoadSheet`.
- **i18n (punctul 2):** fiecare text vizibil e o cheie în `ro.json` (`t("hero.distance")`). Componentele nu conțin text. Numerele și datele merg prin `Intl` cu `ro-RO` (ex. „832 km”, „21,5 t”, „miercuri, 21 octombrie 2026”). Pentru engleză se adaugă `en.json` și se alege limba în `i18n.mjs`, fără modificări în componente. Un test verifică că orice cheie folosită în cod există în `ro.json`.
- Numele orașelor: GeoNames dă „Bucharest”, „Budapest”. În `ro.json` pun forma românească doar pentru orașele unde diferă (`place.683506` → „București”); restul rămân cum sunt în GeoNames. Țările: `Intl.DisplayNames("ro")`.
- Cod de oraș: tabel mic în `city-codes.mjs` (BUC, BUD, SOF…), iar pentru restul primele 3 litere fără diacritice, majuscule. Câmpul `locode` rămâne pregătit (gol până în etapa 2).

## 5. Proveniența fiecărui rând din fișa cursei

Nivelurile sunt cele din regulile tale: **din sursă** (mint), **calculat** (albastru), **estimat** (chihlimbar), **simulat** (violet). Fiecare insignă are și text, nu doar culoare. În plus există starea **„Indisponibil încă — Etapa N”** (gri, text estompat): nu e nivel de proveniență, e un rând fără valoare. Nu afișez nicio valoare pe care motorul nu o are.

| Rând | Valoare în 1A | Nivel | Detaliu în drawer |
|---|---|---|---|
| Origine | oraș GeoNames, țară | din sursă | GeoNames id + link, licență CC BY 4.0, data importului |
| Destinație | idem | din sursă | idem |
| Rută | distanță, durată rută | din sursă | Geoapify Routing, profil camion, ora preluării |
| Țări tranzitate | RO → HU | din sursă | din răspunsul de rutare |
| Punct de frontieră | **Indisponibil încă — Etapa 2** | — | explic de ce (nu e în răspunsul de rutare) |
| Marfă | numele din catalog | **simulat** | alegerea e generată; catalogul e curatoriat FOS |
| Familie / capitol NST | familia FOS + capitol | **estimat** | baza: corespondență propusă de FOS familie→capitol NST 2007; se înlocuiește în Etapa 3 cu corespondența CN→NST (Eurostat) |
| Temperatură | **Indisponibil încă — Etapa 3** | — | catalogul spune doar „specifică produsului” |
| ADR | **Indisponibil încă — Etapa 3** | — | statutul periculos nu se deduce niciodată |
| Ambalare, masă, metri de încărcare | **Indisponibil încă — Etapa 1B** | — | |
| Trailer | numele din catalog | **calculat** | regula marfă→echipament din catalog (euristică de planificare, nu compatibilitate verificată) |
| Ferestre orare | **Indisponibil încă — Etapa 1B** | — | se generează după timpul minim de tranzit |
| Rol expeditor | **Indisponibil încă — Etapa 1B** | — | |

Capitolul NST: înainte să-l afișez, verific lista oficială NST 2007 (UNECE/Eurostat) și mapez doar la nivel de familie, într-un fișier mic `src/data/nst-estimates.mjs`, cu sursa în comentariu. Familiile care nu se potrivesc clar pe un singur capitol primesc intervalul („01–04”), nu o alegere inventată.

Linia „via” din hero: primele 3 drumuri din `namedRoads` (din sursă). Dacă nu sunt returnate: „Drumurile principale nu au fost returnate”.

## 6. Ecranul (după machetă)

- **Bară de sus** lipicioasă: sigla cu camion (SVG), „Freight Ops” + „Generator de curse din lumea reală”, chip-uri cu cursele recente (reiau cursa la click; doar cele cu capete în RO/HU/BG), buton de căutare (Ctrl/⌘+K și „/”), buton „Generează cursă”.
- **Hero:** punct live + id + „date simulate”; codul mare `BUC → BUD`; nume complete; linia „via”; chip-uri: distanță, **durată rută** (nu „condus”: valoarea e durata din rutare, nu timp de condus legal), marfă, trailer, iar masă / temperatură / ADR apar estompate cu „Etapa N”. În dreapta: data generării și „Fereastră încărcare: Indisponibil încă — Etapa 1B”.
- **Glance:** hartă (două coloane pe desktop) + card de marfă (nume, familie, formă de încărcare, linia chihlimbar „De verificat” dacă există `regulatoryReview`).
- **KPI:** distanță, durată rută; masă și metri de încărcare estompate (Etapa 1B); „Cost estimat” și „Pauze șofer” (Etapa 6), „Documente” (Etapa 7).
- **Fișa cursei:** rânduri cu dungă de 3 px în culoarea provenienței, insignă, valoare mono, săgeată; o singură legendă sus. Click pe rând → **drawer** din dreapta (Esc și backdrop închid, focusul intră în drawer și revine pe rând; fundalul devine `inert`).
- **„Cursă nouă”** (drawer): origine / destinație (aleator sau alese din cele 120 de orașe), familie/marfă, trailer filtrat după marfă, „Generează”. Istoric în localStorage (max 30, toate accesările în `try/catch`, aplicația merge și fără stocare).
- **„Despre date”** (drawer): surse și licențe (din `DATA-LICENSES.md`) + legenda de proveniență.
- **Telefon:** fără scroll orizontal; rândurile fișei devin carduri; chip-urile se rup pe mai multe rânduri.
- **Accesibilitate:** butoane și linkuri reale, `:focus-visible`, `aria-live` pentru mesaje, fără culoarea `--dim` pentru text de corp (contrast ≥ 4,5:1, verificat).

## 7. Hartă și print

- **MapLibre GL JS**, versiune exactă fixată, de pe `cdn.jsdelivr.net`; plăci vectoriale **OpenFreeMap** (fără cheie). La implementare verific stilurile disponibile; dacă nu există unul întunecat, folosesc un stil deschis și îi suprascriu culorile (fundal, apă, uscat) ca să se potrivească cu interfața. Linia rutei în culoarea de accent, cu strălucire; marcaje A/B; `fitBounds`; atribuire vizibilă (OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors).
- Geometria vine din răspunsul de rutare existent. În `truck-route.mjs` scot apelul la Static Maps (și `mapImageDataUrl`/`mapError`) ⇒ mai puține credite Geoapify și răspuns mai mic. Istoricul vechi cu `mapImageDataUrl` rămâne valid (câmpul e ignorat).
- **Print:** `window.print()` cu `@media print` (temă deschisă, o pagină): rezumatul hero, instantaneu al hărții, fișa cu etichete de proveniență. Harta se salvează ca imagine (`preserveDrawingBuffer` + `toDataURL` după evenimentul `idle`) și se pune într-un `<img>` care apare doar la print.
- Dacă încărcarea hărții eșuează (CDN, plăci), apare un panou cu mesajul și, la print, simplu textul fără hartă. Nu blochează restul paginii.

## 8. Teste și verificare

- `node --test` rămâne verde (motorul nu se schimbă). Teste noi: (a) fiecare rând din `buildLoadSheet` are nivel valid sau „indisponibil” cu etapă; (b) niciun rând „din sursă” fără sursă + URL + dată; (c) fiecare cheie `t("…")` din cod există în `ro.json`; (d) formatarea `ro-RO` (distanță, durată, masă, dată); (e) codurile de oraș; (f) filtrul RO/HU/BG.
- Rulare locală: server static + **răspuns de rutare înregistrat, marcat ca fixture de test** (nu intră în producție), pentru că cheia Geoapify nu e pe calculatorul meu. Captură de ecran în Chrome headless pe desktop și, cu emulare de dispozitiv, pe telefon; print în PDF pe ambele lățimi; verific lipsa scroll-ului orizontal și contrastul.
- Ce **nu** pot testa eu: ruta reală Geoapify, încărcarea reală a plăcilor OpenFreeMap din rețeaua ta, printul de pe un telefon fizic. Acestea intră în lista ta de verificat pe Deploy Preview.

## 9. Decizii de care am nevoie (recomandarea mea e prima)

1. **Textele din catalog (mărfuri, trailere).** (a) *Recomandat:* traduc în `ro.json` doar numele, familiile și categoriile de trailer (~120 de texte); notele lungi (manipulare, variante, verificări) rămân în engleză, marcate discret „(în engleză)”, până în etapele 3–4, când catalogul e oricum refăcut. (b) Traduc tot acum (mult text care se rescrie curând). (c) Totul rămâne în engleză.
2. **Scoaterea căutării Geoapify manuale și a directorului de companii din interfață** (nu au sens fără coridoare RO/HU/BG; funcția `search-places.mjs` rămâne în repo). Locațiile alese manual se aleg din cele 120 de orașe. Ok?
3. **`AGENTS.md` în engleză** (ca în promptul tău, e un fișier de reguli pentru unelte), `CLAUDE.md` scurt care îl încarcă (`@AGENTS.md`), iar documentele pentru tine (planuri, rapoarte) în română. Ok?
4. **Deploy Preview:** Netlify trebuie să construiască previzualizări pentru PR-uri și `GEOAPIFY_API_KEY` să aibă scope „Deploy Previews” (README-ul o cere deja). Confirmi că așa e setat? Dacă nu apare preview-ul, îți spun ce setare Netlify să verifici.

## 10. Pașii (commit-uri mici), după aprobare

1. `AGENTS.md`, `CLAUDE.md`, planul (acest fișier) — **planul îl comit acum, local, fără push**.
2. Fonturi + tokenuri + CSS de bază.
3. i18n (`ro.json`, `i18n.mjs`) + teste de formatare.
4. View-model (proveniență + `buildLoadSheet`) + teste.
5. Shell nou: bară, hero, glance, KPI.
6. Hartă MapLibre; scoatere Static Maps din funcție.
7. Fișa cursei + drawer.
8. „Cursă nouă”, paletă, istoric.
9. „Despre date”, print.
10. Versiune 0.10.0, `CHANGELOG.md`, `README.md`, `DATA-LICENSES.md` (fonturi, MapLibre, OpenFreeMap).

Apoi: push, PR (dacă `gh` nu e instalat, îți dau linkul `pull/new/...`), Deploy Preview și lista de verificat pe desktop și pe telefon. **Nimic nu se unește în `main` fără aprobarea ta explicită.**
