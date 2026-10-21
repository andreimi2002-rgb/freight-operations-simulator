# V1 · Etapa 1B — Fundație: modelul cursei, primele calcule, scoaterea ATS/ETS2

Stare: **de aprobat** (nimic nu e implementat).
Branch: `feature/v1-phase1b`, din `main` după merge-ul PR #5 (`746771c`).
Interfața din 1A rămâne aceeași; se schimbă doar ce e în spatele ei. Singura funcție de legătură, `buildLoadSheet`, va citi modelul nou `Load` în loc de misiunea veche.

## 1. Ce am verificat înainte (surse oficiale, nu din memorie)

| Ce | Valoare | Sursă |
|---|---|---|
| Timp de condus zilnic | max. 9 h (10 h de cel mult 2 ori pe săptămână) | Reg. (CE) 561/2006, art. 6(1) |
| Pauză | 45 min după 4 h 30 min de condus (sau 15 + 30 min) | art. 7 |
| Repaus zilnic | normal ≥ 11 h; redus 9–11 h, de max. 3 ori între repausurile săptămânale | art. 4(g), 8(2), 8(4) |
| Limite săptămânale | 56 h/săptămână, 90 h/2 săptămâni; repaus săptămânal 45 h (redus 24 h) | art. 6(2), 6(3), 4(h), 8(6) |
| Europaletă EPAL | 1200 × 800 × 144 mm, sarcină de lucru 1.500 kg | [EPAL](https://www.epal-pallets.org/eu-en/load-carriers/epal-euro-pallet) |
| Semiremorcă cu prelată, interior | 13,62 × 2,48 × 2,70 m, sarcină utilă 32.800 kg | [DSV](https://www.dsv.com/en/our-solutions/modes-of-transport/road-transport/trailer-sizes/curtain-trailer), confirmat de [DP World](https://www.dpworld.com/en/supply-chain-solutions/freight-forwarding/multimodal-solutions/europe/equipment/euroliners) (33 europaleți) |
| Semiremorcă frigorifică, interior | 13,31 × 2,48 × 2,60 m, sarcină utilă 31.000 kg | [DSV](https://www.dsv.com/en/our-solutions/modes-of-transport/road-transport/trailer-sizes/reefer-trailer) |
| Limite legale de gabarit | 16,50 m articulat, 2,55 m (2,60 m izoterm), 4,00 m, 40 t | Directiva 96/53/CE, anexa I — **nu le folosesc încă** (Etapa 4) |

Textul regulamentului l-am citit din copia [legislation.gov.uk](https://www.legislation.gov.uk/eur/2006/561/data.htm) (EUR-Lex nu se poate citi automat). La implementare citez linkul ELI EUR-Lex și verific că textul UE consolidat e identic pentru articolele folosite.

**Atenție:** Directiva 96/53/CE **nu** stabilește o „lungime utilă de 13,6 m”; cifra vine de la operatori și producători. Dimensiunile podelei sunt deci „din sursă (fișa tehnică a unui operator, valoare tipică)”, nu „din lege”, iar DSV avertizează că variază după producător și an. Așa le și etichetez.

## 2. Structura codului

```
src/engine/                  funcții pure, fără DOM, toate testate
  provenance.mjs             sourced / computed / estimated / simulated + validator (mutat din view-model)
  load-model.mjs             createLoad(), validateLoad()  → documentat în docs/LOAD-MODEL.md
  cargo.mjs                  alegerea mărfii
  equipment.mjs              alegerea trailerului + compatibilitate
  load-planning.mjs          paleți, masă, metri de încărcare (§4)
  transit-time.mjs           timpul minim de tranzit (§5)
  time-windows.mjs           ferestrele orare generate după tranzit (§5)
  route.mjs                  cheamă adaptorul de rutare
  generator.mjs              compune un Load complet
  trucks.mjs, driver-hours.mjs, costs.mjs, documents.mjs   stub-uri: null + TODO (Etapele 4, 6, 6, 7)
src/adapters/
  routing-geoapify.mjs       route({origin, destination, vehicle}) → {distanceM, durationS, geometry,
                             countries, viaNames, provider, retrievedAt}; în Etapa 5 îl înlocuiește un ruter OSM
  map-maplibre.mjs           harta din 1A, mutată aici
src/data/cargo/  src/data/equipment/  src/data/regulations/  src/data/places/
src/ui/                      un modul pe panou, citesc doar din fișa construită din Load
archive/                     game-reference-catalog.mjs (cu notificarea CC BY-SA intactă), pentru Etapa 8
```

- **Se scot ATS/ETS2** din motor și UI. `mission-engine.mjs` dispare după ce nimic nu-l mai importă.
- **Coridoarele și directorul de companii** (`freight-network.mjs`) le **șterg**. Erau conținut FOS original despre SUA/Europa de Vest, fără legătură cu scopul, iar istoricul git le păstrează. Arhivez doar catalogul din joc (licență CC BY-SA, necesar în Etapa 8).
- `search-places.mjs` rămâne nefolosit până în Etapa 2, cum ai cerut.

## 3. Modelul `Load` (fiecare valoare are proveniență)

```
id, createdAt, schemaVersion: 3
scope.countries ["RO","HU","BG"]
origin / destination   name, countryCode, lat, lon, timeZone, geonamesId, placeType "city",
                       locode null (Etapa 2)                                       → din sursă
route                  distanceKm, durationH, countries[], viaNames[], geometry,
                       provider, retrievedAt                                        → din sursă
                       borderCrossings []  (gol până în Etapa 2, cum ai decis)
cargo                  id, name, family, nstChapter (estimat), cnCode null (Etapa 3),
                       adr null (Etapa 3), temperature null (Etapa 3), loadForm, handlingNotes[]
packaging              unitType, unitDims, unitCount, unitMassKg, totalMassKg, loadingMetres  (§4)
equipment              trailerId, name, floor (din sursă sau null), checks[]
transit                minimumH, drivingH, breaks[], dailyRests[], ruleSet "561/2006 simplificat"  (§5)
timeWindows            loading {from,to}, unloading {from,to}                       → simulat
parties                shipperRole, consigneeRole                                   → simulat
truck null (4) · driver null (6) · costs null (6) · documents [] (7)
warnings[]             ce trebuie verificat de utilizator
```

## 4. Primele calcule: ambalare, masă, metri de încărcare

- **Tipul unității:** europaleta EPAL (din sursă) pentru mărfurile care se transportă paletizat. Pentru vrac, cisterne, animale vii, vehicule, bușteni, bobine și utilaje: **„Indisponibil încă — Etapa 3/4”**, cu motivul. Nu inventez o unitate.
- **Numărul de paleți** (calculat): câte încap pe podea (rânduri × coloane, paleți pe lungime, 3 pe lățime: 11 × 3 = 33 pe ambele tipuri de mai sus). Se limitează și la sarcina utilă a trailerului de referință (din sursă).
- **Masa pe palet** (estimat): un interval pe marfă cu baza scrisă (ex. „cutii de fructe pe palet, încărcare tipică”). Folosesc mijlocul intervalului, afișat ca „≈ 650 kg”.
- **Masa totală** (calculat, marcat „depinde de o estimare”): număr × masă pe palet.
- **Metri de încărcare** (calculat geometric): rânduri ocupate × 1,2 m. Nu folosesc formula convențională „/2,4” fără sursă.
- **Trailere fără dimensiuni cu sursă** (platformă, basculantă, cisterne etc.): podeaua e `null`, iar ambalarea apare „Indisponibil încă — Etapa 4”. Pentru semiremorca box verific pagina DSV la implementare; dacă nu se poate cita, rămâne `null`.
- **Nu adaug încă limite legale de masă** (Etapa 4), cum cerea promptul.

## 5. Timpul minim de tranzit și ferestrele orare (varianta simplificată, ca la punctul 4 aprobat de tine)

**Tranzit (calculat):**
1. Pornește de la durata de condus din rutare (Geoapify; o estimare de trafic, nu timp de tahograf).
2. După fiecare 4 h 30 min de condus se adaugă o pauză de 45 min.
3. După 9 h de condus într-o zi se adaugă un repaus zilnic de 11 h.
4. Ipoteze conservatoare: un singur șofer, fără prelungire la 10 h, fără repaus redus, fără pauze împărțite. Cursele RO/HU/BG nu ajung la limitele săptămânale, dar le verific și adaug avertisment dacă s-ar atinge.

Drawer-ul arată formula, valorile de intrare și articolele citate. Planificarea completă (prelungiri, repaus redus, restricții de weekend pe țări) rămâne în **Etapa 6**.

**Ferestre (simulate, generate după tranzit):**
- Încărcarea: o zi lucrătoare (luni–vineri), interval de 1 h 30 min între 06:00 și 14:00, **ora locală a orașului** (fusul orar din GeoNames: RO/BG UTC+2/+3, HU UTC+1/+2).
- Descărcarea: cel mai devreme la sfârșitul încărcării + timpul minim de tranzit, plus o marjă simulată de 0–3 h, rotunjit la jumătate de oră, între 06:00 și 18:00 ora locală; altfel, a doua zi la 06:00.
- Dacă o fereastră ar cădea în weekend: mut încărcarea și adaug avertismentul „restricțiile de weekend nu sunt încă verificate (Etapa 6)”.

**Roluri (simulate):** expeditor și destinatar dintr-o listă mică pe familie de marfă (ex. producător → distribuitor; terminal portuar → depozit). Fără companii reale.

## 6. Catalogul de orașe RO/HU/BG

Regenerez catalogul din `cities15000` GeoNames pentru **toate** localitățile RO/HU/BG cu ≥ 15.000 de locuitori, excluzând codul GeoNames `PPLX` („secțiune de localitate” = sectoarele Bucureștiului, districtele Budapestei). Asta înlocuiește lista manuală de excluderi din 1A. Estimez ~200–250 de orașe față de 90 acum (cifra exactă o raportez). Fiecare oraș își păstrează ID-ul GeoNames, sursa și fusul orar; atribuirea CC BY 4.0 rămâne.

Importatorul e acum un script PowerShell. Îl rescriu în Node (`scripts/import-geonames.mjs`) ca să meargă și pe Netlify/Linux, cu verificări care refuză scrierea dacă rezultatul arată greșit.

## 7. Teste (`node --test`)

- **provenance:** helperi și validator; o valoare „din sursă” fără sursă e respinsă.
- **load-model:** validarea modelului.
- **cargo / equipment:** compatibilitatea.
- **load-planning**, cu valori fixe: 33 paleți pe 13,62 × 2,48; limitarea la sarcina utilă; metrii de încărcare; „indisponibil” pentru trailere fără podea cu sursă.
- **transit-time**, cu cazuri fixe:
  - 4 h de condus → 4 h;
  - 6 h → 6 h 45 min;
  - 11 h 20 min → 9 h de condus, cu o pauză, + 11 h repaus + 2 h 20 min de condus;
  - limitele de 9 h și 4 h 30 min.
- **time-windows:** numai zile lucrătoare, ore locale, descărcarea ≥ încărcare + tranzit, fusuri orare diferite RO ↔ HU.
- **generator:** forma rezultatului pentru RO/HU/BG, cu un adaptor de rutare simulat.
- **curățenie:** nicio referință ATS/ETS2 în `src/engine` sau `src/ui`.
- **teste existente:** cele din 1A (traduceri, scope, print) rămân și se actualizează pe modelul nou.

## 8. Decizii de care am nevoie (recomandarea mea e prima)

1. **Masa pe palet:** (a) *recomandat:* estimări doar pentru mărfurile paletizate (~35–40 din 79); restul „Indisponibil încă” cu motiv. (b) Pentru toate 79, inclusiv vrac (densități) și cisterne (volume), cu mai multe estimări greu de susținut.
2. **Istoricul salvat din 1A:** (a) *recomandat:* începem un istoric nou (cheie nouă), fără să-l șterg pe cel vechi. Cursele din 1A nu au datele noi și ar arăta jumătate goale. (b) Le convertesc, cu rândurile noi „Indisponibil”.
3. **Catalogul de orașe:** (a) *recomandat:* toate localitățile ≥ 15.000 de locuitori, fără `PPLX` (~200–250). (b) Doar primele 40 pe țară, ca acum (~120 după curățare).
4. **Destinatarul:** pe lângă rolul expeditorului, adaug și rolul destinatarului (simulat)? *Recomandat:* da, fiecare cursă are două capete.

## 9. Pași (commit-uri mici), după aprobare

1. Planul (acest fișier) — **comis acum local, fără push**.
2. `src/engine/provenance.mjs` + `load-model.mjs` + `docs/LOAD-MODEL.md` + teste.
3. Datele noi cu sursă: `regulations/` (EPAL, Reg. 561/2006), `equipment/` (podele), estimările pe marfă.
4. `load-planning.mjs`, `transit-time.mjs`, `time-windows.mjs` + teste.
5. Adaptorul de rutare și `generator.mjs`; scoaterea ATS/ETS2; arhivarea catalogului de joc.
6. Importatorul Node și catalogul RO/HU/BG regenerat.
7. `buildLoadSheet` pe modelul nou; rândurile Ambalare, Masă, Ferestre și Roluri devin active; drawer-ul arată formulele.
8. Versiunea 0.11.0, `CHANGELOG`, `README`, `DATA-LICENSES` (EPAL, DSV/DP World, Reg. 561/2006).

Apoi: verificare în browser (desktop + telefon, print), push, link de PR, lista de verificat. **Nimic în `main` fără aprobarea ta.** După 1B: pozele orașelor (PR separat), cum ai stabilit.
