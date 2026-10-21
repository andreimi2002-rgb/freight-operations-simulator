# FOS — Plan de dezvoltare (roadmap)

Actualizat: 20 octombrie 2026. Documentul de referință pentru ordinea etapelor și pentru regulile de produs care decurg din imaginile de viziune. Regulile permanente de lucru sunt în [AGENTS.md](../AGENTS.md); modelul cursei în [LOAD-MODEL.md](LOAD-MODEL.md).

Notă: punctele marcate **[propunere acceptată]** au fost propuse de asistent în timpul analizei planului și acceptate de proprietar la 20 octombrie 2026. Restul vine direct de la proprietar.

## 1. Ordinea etapelor

| Etapa | Conținut | Stare |
|---|---|---|
| **1A** | Redesign în stilul Airport Live, hartă MapLibre + OpenFreeMap, fișa cursei cu proveniență, i18n (română) | făcută (PR #5) |
| **1B** | Fundație: modelul `Load`, paleți / masă / metri de încărcare, timp minim de tranzit (Reg. 561/2006, simplificat), ferestre orare, roluri, catalog RO/HU/BG regenerat, scoaterea ATS/ETS2 | făcută (PR #6) |
| **1C** | Navigare pe tab-uri (schelet) + țările devin date, vezi §2 | făcută (PR #7) |
| **1D** | Fotografii și vreme pentru orașe (un singur PR, două părți independente), vezi §3 | în revizie |
| **2A** | Distanță pe țări, puncte de frontieră, coduri UN/LOCODE | făcută (PR #9) |
| **2B** | Locuri reale de încărcare din OpenStreetMap (zone industriale, porturi, terminale, silozuri), fără nume de firme | în revizie |
| **2 (restul)** | Locații reale din OpenStreetMap (depozite, zone industriale, porturi, terminale, puncte de frontieră, parcări TIR), coduri UN/LOCODE, **distanța pe țări** din poligoane Natural Earth [propunere acceptată] | |
| **3** | Mărfuri v2: coduri CN/HS, ADR (număr ONU, clasă, grupă, cod de tunel), ambalare și mase cu sursă, **volum în m³ din înălțimea stivei estimată pe marfă**, **orientarea paleților aleasă de motor (varianta mai bună, ambele în drawer)** [propuneri acceptate], ponderare după fluxuri Eurostat, corespondența CN→NST | |
| **4** | Camioane și trailere reale cu specificații și sursă (putere, cuplu, consum ca estimat), configurații, verificarea masei (Directiva 96/53/CE) | |
| **5** | Rutare proprie din OSM (începe cu o probă mică; decizia după ea), taxe de drum din tarifele oficiale, **relief și profil de altitudine din date de elevație deschise (licență verificată)** [propunere acceptată]; Geoapify iese | |
| **6** | Timpi de condus completi (Reg. 561/2006: prelungiri, repaus redus, repaus săptămânal), restricții de weekend și sărbători pe țări, costuri (motorină din Weekly Oil Bulletin, taxe) cu **moneda declarată** [propunere acceptată] | |
| **Pachete de țară** | Extinderea pe țări noi, vezi §4. Primul pachet: **Grecia și Austria** | |
| **7** | Documente: CMR și document de transport ADR, printabile | |
| **8** | Modul ETS2/ATS ca adaptor peste același motor | |

Fiecare etapă: plan în `docs/`, aprobare, un branch și un PR, Deploy Preview verificat, merge doar cu aprobarea proprietarului.

## 2. Etapa 1C — navigare pe tab-uri

Schelet de navigare în stilul imaginilor din [`docs/vision/`](vision/). Imaginile sunt **inspirație** pentru aspect și structură, nu specificație (regulile din §5 au prioritate).

Tab-uri, în ordine: **Prezentare**, **Hartă și rută**, **Marfă**, **Camion și trailer**, **Program și pauze**, **Costuri**, **Documente**, **Surse și calcule**.

- Fiecare tab arată ce există deja în cursă. Ce lipsește apare „Indisponibil încă — Etapa N”, exact ca rândurile din fișa actuală, cu proveniența la vedere.
- **Nu** intră în v1: tab-urile sau secțiunile Flotă, Companii, Statistici, Evenimente.
- Vizibil în imagini, dar condiționat de reguli: fotografii (Etapa 1D și ulterior), stratul Satelit (interzis până la verificarea licenței), profil de altitudine (Etapa 5).
- **[propunere acceptată]** Tot în 1C, țările devin **date** (lista țărilor active, un fișier de orașe pe țară, texte cu parametru), ca extinderea pe țări noi să nu ceară cod nou. Detalii în §6.

## 3. Etapa 1D — fotografii și vreme pentru orașe

Un singur PR, cu două părți independente: **fotografiile** (date pregătite offline) și **vremea** (funcție live). Ambele apar pe cardurile orașelor de origine și destinație din „Prezentare” și „Hartă și rută”.

### Fotografii

- Fotografii din **Wikimedia Commons**, găsite prin **Wikidata** pornind de la ID-ul GeoNames al orașului (proprietatea P1566 → imaginea P18 sau bannerul Wikivoyage P948).
- Script **generic pe coduri de țară** (aceeași logică pentru orice pachet de țară), rulat întâi pe catalogul regenerat RO/HU/BG. Fotografiile se pregătesc dinainte (fișier de date), nu se caută live.
- Pe fiecare fotografie: autor, licență și link la pagina originală. Doar licențe libere (domeniu public, CC0, CC BY, CC BY-SA), linkuri verificate de script, potriviri ambigue sărite, nu ghicite.
- Fallback stilizat (panou cu gradient și codul orașului) când nu există o fotografie liberă sau imaginea nu se încarcă, ca în Airport Live.
- Fiecare oraș din catalog are fotografie: imaginea principală din Wikipedia ca rezervă, poze alese manual pentru orașele mari rămase (`src/data/photos/curated.json`, aceleași verificări), iar orașele mici fără poză liberă sunt scoase din catalog (`src/data/places/exclusions.json`). Pentru pachetele de țară se aplică aceeași regulă.
- Licențe acceptate ca în Airport Live: domeniu public, CC0, CC BY, CC BY-SA, {{Attribution}} și Free Art License. Pozele se încarcă direct de pe serverele Wikimedia (fără referrer).

### Vreme (adăugată de proprietar la 20 octombrie 2026)
- Doar vremea orașelor de **origine și destinație**, cu puține detalii (nu ca în aviație): **acum** (temperatură, starea cerului, vânt, precipitații), **următoarele 3 zile** (minimă, maximă, starea cerului) și **vremea estimată la fereastra de încărcare și la cea de descărcare**.
- Sursa: **MET Norway Locationforecast** (fără cheie, CC BY 4.0, credit în aplicație). Funcție Netlify `/api/weather/<ID GeoNames>`: orașul se caută pe server în datele noastre (browserul nu trimite coordonate), cache 15–30 min, limită de cereri, identificare prin User-Agent conform termenilor MET Norway.
- Unități: °C, km/h, mm. Pictograme proprii (8 stări), nu emoji.
- Proveniență „din sursă”, cu ora preluării. Vremea **nu se salvează** în cursă (se schimbă): se cere la fiecare deschidere; stări clare de încărcare, eroare și date vechi.
- Nu intră acum: alerte meteo oficiale și vremea pe traseu (Etapa 5–6).

## 4. Pachete de țară (după Etapa 6)

Extinderea se face în pachete de **1–2 țări**, alese de proprietar. Un pachet înseamnă **doar date, fără cod nou**:

1. orașe (GeoNames) și fotografiile lor (Wikimedia Commons);
2. locații OSM (depozite, zone industriale, porturi, terminale, puncte de frontieră, parcări TIR);
3. rețeaua de drumuri pentru ruterul propriu;
4. taxe de drum din tarifele oficiale;
5. restricții de circulație de weekend și sărbători legale;
6. prețul motorinei (Weekly Oil Bulletin);
7. traduceri (nume de orașe, texte specifice);
8. o cursă de test care trece toate verificările.

**Primul pachet: Grecia și Austria.** Cerințe pe care codul trebuie să le poată exprima ca date **[propuneri acceptate]**:

- **Grecia:** segmente cu **feribot** (insule), drumuri montane, taxe pe stații de taxare. Modelul `Load` și ruterul trebuie să știe de segmente cu feribot (timp, cost, program).
- **Austria:** interdicții **sectoriale și de noapte** pentru camioane, în plus față de weekend, și taxă pe kilometru. Restricțiile sunt date cu **perioadă de valabilitate** și sursă, nu doar „sâmbătă–duminică”.
- Ambele țări se învecinează cu scopul actual (Ungaria, respectiv Bulgaria): apar **curse între pachete** (ex. România → Austria prin Ungaria). Fiecare pachet include o cursă de test de acest fel.
- **Monede:** costurile declară moneda și data cursului (RON, HUF, EUR; la Bulgaria se verifică starea trecerii la euro).

## 5. Reguli pentru ce apare în imaginile din `docs/vision/` (permanente)

Imaginile arată cum trebuie să arate produsul înainte de lansare. Conținutul lor **nu** se copiază:

- **Fotografii:** pozele din imagini sunt generate cu AI. **Nu folosim imagini generate.** Fotografii doar din Wikimedia Commons, cu autor, licență și link: orașe, modele de camioane, tipuri de trailer. Pentru marfă și locații fără poză liberă: panou stilizat sau poză generică marcată „ilustrativ”.
- **Companii:** fără nume de companii inventate (ex. „Tatabánya Logistics Center”). Expeditorul și destinatarul rămân **simulate** (rol, nu firmă); locația poate fi un loc real din OSM, fără un nume de firmă pus pe el.
- **Mărci de produse:** mărci reale (ex. Borsec) doar ca exemple cu sursă. Cifrele (greutate, baxuri pe palet) vin din fișa producătorului sau din Open Food Facts (ODbL, cu atribuire) ori sunt marcate „estimat”. Catalogul se construiește pe **categorii generice** cu valori tipice estimate. **[propunere acceptată]** Open Food Facts e ODbL cu *share-alike*: o bază derivată publicată de noi ar trebui să rămână ODbL, deci OFF se folosește doar pentru exemple punctuale, cu atribuire, nu prin import în masă.
- **Cifrele se recalculează de motor, nu se copiază.** Exemplu: metrii de încărcare se calculează din paleții efectiv încărcați, niciodată din lungimea trailerului. 26 europaleți 1200 × 800 așezați câte doi pe lățime = 13 rânduri × 0,8 m ≈ 10,4 m (imaginea arată greșit 13,6 m). Același lucru pentru masă, volum, viteză medie, program estimat etc.
- **Timpul de așteptare la graniță** din imagini (ex. „Trecere frontieră 30–60 min” la Nădlac) **nu se copiază**: granițele terestre dintre România, Ungaria, Bulgaria, Austria și Grecia sunt interne Schengen, fără control (de confirmat la Etapa 2). Un timp de așteptare apare doar la granițe externe (ex. Serbia, Moldova, Turcia) și doar ca **estimat**. **[propunere acceptată]**
- **Harta:** stratul „Satelit” **nu** se implementează până nu verificăm licența sursei de imagini. Relief și profil de altitudine din date de elevație gratuite sunt în regulă.

Fișierele din `docs/vision/` sunt **machete generate cu AI**, păstrate doar ca inspirație pentru structură și aspect; nu sunt specificație, nu sunt fotografii și nu se redistribuie ca imagini ale produsului.

## 6. Ce presupune azi codul despre țări (verificat la 1B) și ce trebuie schimbat

Motorul de calcul (paleți, tranzit, ferestre, roluri, proveniență) nu depinde de țară. Lista țărilor apare însă ca **constantă** în câteva locuri. Nimic nu blochează adăugarea unei țări, dar aceste puncte devin date **în Etapa 1C** **[propunere acceptată]**. *Stare după 1C:* lista țărilor, importatorul, calea către orașe, textele cu țări, limba rutării și testele sunt mutate în date; rămân pentru etapele următoare doar zilele lucrătoare/sărbătorile (6), codurile de oraș (2) și AETR (6).

| Unde | Ce presupune | Ce se schimbă |
|---|---|---|
| `src/engine/load-model.mjs` | `SCOPE_COUNTRIES = ["RO","HU","BG"]`; `validateLoad` respinge alte țări | lista țărilor active într-un fișier de date (`src/data/countries.mjs`), citită de motor |
| `scripts/import-geonames.mjs` | țările și fusurile orare fixe; orașe obligatorii fixe; un singur fișier `cities-ro-hu-bg.json` | țările ca argument / din fișierul de țări; un fișier pe țară (`places/cities-<CC>.json`); fusul orar verificat din datele țării |
| `src/main.js`, `scripts/dev-server.mjs` | calea fixă `cities-ro-hu-bg.json` | încarcă fișierele țărilor active |
| `src/i18n/ro.json` (4 texte) | „România, Ungaria și Bulgaria” scris în text | text cu parametru `{countries}`, construit din lista țărilor (`Intl.DisplayNames`) |
| `src/data/scope.mjs` | coduri de 3 litere doar pentru câteva orașe RO/HU/BG | **făcut în 2A:** UN/LOCODE (241/254 orașe); codul provizoriu rămâne doar pentru orașele fără LOCODE |
| `src/engine/time-windows.mjs` | zile lucrătoare = luni–vineri; fără sărbători legale | sărbătorile și restricțiile de weekend devin date de țară (Etapa 6 / pachete) |
| `netlify/functions/truck-route.mjs` | `lang=ro` la Geoapify | limba din setarea interfeței (temporar; Geoapify iese în Etapa 5) |
| `tests/` | verifică explicit RO/HU/BG | testele citesc lista țărilor din date |
| Reg. 561/2006 | se aplică în UE | pentru țări din afara UE pe traseu (ex. Serbia) se aplică AETR; de tratat în Etapa 6 |

**Pentru tab-uri (1C):** nimic nu complică. Interfața citește deja doar din `buildLoadSheet(load)`; funcția va întoarce rândurile grupate pe tab (fiecare rând are deja un `id`), iar drawer-ul, proveniența și print-ul rămân la fel.
