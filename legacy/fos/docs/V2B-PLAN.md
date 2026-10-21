# Etapa 2B — locații reale din OpenStreetMap (plan)

Stare: **aprobat de proprietar la 21 octombrie 2026; implementat** (0.15.0). Abateri față de plan: terminalele feroviare și parcurile logistice sunt rare în OSM, deci apar puține; silozurile nu au niciodată nume afișat. Branch: `feature/v2b-osm-locations`. Un singur PR.

## 1. Ce rezolvă
Azi o cursă pornește și ajunge „în oraș” (centrul din GeoNames). 2B adaugă **locuri reale de încărcare și descărcare** din OpenStreetMap, în orașele din catalog: zone industriale, porturi, terminale, parcuri logistice. Cursa devine, de exemplu, „Zona industrială X, Arad → Portul Y, Constanța”, cu coordonatele locului folosite pentru rută.

## 2. Ce intră și ce nu
**Intră** (categorii cu nume public în OSM):
| Categorie | Etichete OSM |
|---|---|
| Zonă / parc industrial | `landuse=industrial` cu nume care conține „industrial”, „zonă”, „parc”, „ipari”, „индустриална” etc. |
| Port / terminal portuar | `harbour=*`, `landuse=port`, `industrial=port` |
| Terminal feroviar / intermodal | `railway=goods_station`, `industrial=intermodal`, `landuse=railway` cu nume public |
| Parc logistic | `industrial=logistics`/`warehouse` doar dacă numele e de parc, nu de companie |
| Siloz / terminal cereale | `man_made=silo`, doar nume geografic public |

**Nu intră** (reguli permanente):
- nume de companii private pe locații; dacă numele OSM nu trece filtrul, locul apare **generic** („Zonă industrială, Arad”) sau e exclus;
- depozite individuale ale unor firme, benzinării, magazine;
- vehicule cu livrea de transportator;
- timpi de așteptare sau program de acces (nu avem sursă);
- puncte de frontieră (sunt deja în 2A) și parcări TIR (le tratăm separat, în etapa 6, la pauze).

## 3. Date și licență
- Sursa: OpenStreetMap prin Overpass, **ODbL 1.0**, © OpenStreetMap contributors. Pregătite **offline** de un script (`scripts/build-locations.mjs`), ca la 2A; aplicația nu interoghează Overpass.
- Fișiere: `src/data/places/locations-<CC>.json` (câte unul pe țară; țările rămân date, nu cod).
- Fiecare loc: `id` OSM (`way/123`), tip, nume (sau `null`), poziție (centru), orașul GeoNames căruia îi aparține (cel mai apropiat, în ≤ 15 km), eticheta de provenință „Din sursă”, link OSM, data preluării.
- `DATA-LICENSES.md` primește secțiunea ODbL pentru locații (atribuire + share-alike pe baza derivată).

## 4. Filtrul de nume (cheia etapei)
Un nume rămâne doar dacă:
1. conține un cuvânt dintr-o listă de **termeni de loc public** (per limbă, ca date: RO, HU, BG), sau e un toponim din GeoNames (de ex. „Portul Constanța”);
2. **nu** conține forme de firmă (S.A., S.R.L., Kft., Zrt., ООД, АД, GmbH, Ltd, „&”) și nu apare în `operator=*`/`brand=*` al obiectului;
3. nu e identic cu `operator`/`brand`/`name:brand`.

Altfel: nume generic din categorie + oraș. Un test verifică lista de excluderi pe exemple reale, iar scriptul scrie un raport cu numerele (păstrate / generice / excluse) pentru verificarea ta.

## 5. Model și motor
- `origin`/`destination` rămân orașe (GeoNames); se adaugă `originSite` / `destinationSite` (fapte `sourced`, opționale): `{ osmId, kind, name|null, lat, lon, cityGeonamesId }`.
- Generatorul: după alegerea orașelor, alege cu probabilitate un loc potrivit **tipului de marfă** (ex. cereale → siloz/port; paleți → parc logistic/zonă industrială; containere → port/terminal), cu un tabel în date.
- Ruta se cere între coordonatele locurilor (dacă există), altfel între orașe, ca acum. Schema încărcării rămâne 3 (câmpuri opționale noi); încărcările vechi rămân valide.
- Antetul, harta (pinii A/B la locul real) și „Origine/Destinație” arată locul + orașul; sertarul arată sursa OSM, licența și linkul.

## 6. Interfață
- Rândurile „Origine” și „Destinație”: „Zonă industrială X · Arad” + sertar cu provenință.
- Harta: pinii A/B se mută la locuri; textul alternativ se actualizează.
- Tipărire: aceeași pagină, locurile apar în coloana existentă.
- Texte doar în `src/i18n/ro.json`.
- Dacă fișierul de locații lipsește sau orașul nu are locuri: cursa merge ca azi, fără eroare.

## 7. Teste (automate)
- filtrul de nume (firme, operatori, forme juridice, toponime publice, limbi RO/HU/BG);
- gruparea elementelor apropiate și atribuirea la oraș;
- alegerea locului după marfă (determinist cu `random` injectat);
- încărcare cu loc: schema, proveniența, `validateLoad`; încărcare fără loc rămâne validă;
- vizualizare: rândurile și harta; traducere completă;
- fișiere de date: fără nume cu forme de firmă, toate locurile au oraș și link OSM.

## 8. Verificări în browser (le fac eu, apoi tu pe Deploy Preview)
Desktop și telefon (390 / 320 px), sertar, hartă cu pini la locuri, tipărire pe o pagină, cazul „fără locuri”, eroare de încărcare a fișierului. Ce nu pot testa: ruta reală Geoapify între coordonatele locurilor — o verifici tu pe Deploy Preview.

## 9. Riscuri
- **Acoperire inegală în OSM** (unele orașe mici nu vor avea locuri): rămân pe oraș, fără eroare.
- **Nume de firmă strecurate** sub formă de toponim: filtrul e prudent (mai bine generic decât risc); raportul scriptului îți arată rezultatul.
- **Overpass lent la ore de vârf**: script cu reîncercări, ca la 2A.
- **ODbL**: baza derivată cere atribuire și share-alike; documentat.

## 10. Întrebări pentru tine (cu recomandare)
1. **Alegerea locului:** automat, după marfă (recomandat); alegerea manuală intră mai târziu, în generator.
2. **Țări:** RO, HU, BG ca până acum (recomandat).
3. **Nume cu aspect de firmă:** generic, nu excludere (recomandat), ca să nu pierdem locurile.
4. **Depozite individuale:** nu intră (recomandat), fiindcă numele lor sunt aproape mereu de firmă.

## 11. Ce urmează după aprobare
Branch nou → script și date → motor și model → interfață → teste → verificare în browser → docs (CHANGELOG 0.15.0, DATA-LICENSES, LOAD-MODEL, ROADMAP) → push și link de PR cu lista de verificat.
