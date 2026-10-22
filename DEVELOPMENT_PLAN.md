# Freight World — Development Plan

> Acest fișier este planul principal al proiectului. Claude Code îl citește la începutul
> fiecărei etape. Orice decizie importantă care schimbă planul se notează aici,
> în secțiunea **Jurnal de decizii**, la final.

---

## 1. Ce este proiectul

**Freight World** este evoluția proiectului FOS (Freight Operations Simulator).

Este un **generator de curse în stil ATS / ETS2**, construit pe harta reală a jocurilor
(orașe, companii, depozite, mărfuri, remorci), combinat cu **pagini de oraș vii**
care arată ora locală reală, vremea reală și o poză reală a orașului.

Nu este un joc (utilizatorul nu conduce nimic) și nu este o bursă de curse reale.
Este un **generator de realitate**: îți arată ce curse ar putea pleca azi, la ora asta,
din fiecare oraș, între companii care chiar există în joc.

Trei idei stau la bază:
- **Pagina orașului**: oraș viu, cu poză, oră, vreme, companii, servicii, drumuri.
- **Tabela de plecări**: ca un panou de aeroport, dar pentru curse de camion.
- **Fișa cursei**: foarte detaliată — marfă, greutate, remorcă, camion, rută, DLC-uri, vreme.

### Principii
1. **Detaliu și realism înaintea a orice.** Fiecare cursă trebuie să poată fi făcută în joc.
2. **Mereu ceva diferit.** Tabela se schimbă în fiecare oră.
3. **Fără API-uri plătite.** Toate sursele de date sunt gratuite și stabile.
4. **Date curate, nu ghicite.** Ce nu se știe sigur se marchează ca `null` sau „estimare”.
5. **Calitate înaintea cantității.** Mai bine puține orașe perfecte decât multe goale.
6. **Funcționează la fel de bine pe desktop și pe telefon.**

### Obiectivul pe termen lung: un produs monetizat
Freight World trebuie să devină un **produs real, de calitate, care aduce bani** prin mai multe
căi. Toate deciziile tehnice de acum trebuie să lase deschise aceste căi.

**Direcția principală: aplicație companion conectată la ETS2 / ATS în timp real.**
- Aplicația (desktop, eventual și telefon ca al doilea ecran) se conectează la jocul care rulează,
  prin **SCS Telemetry SDK** (SDK-ul oficial SCS pentru date din joc) și un plugin de telemetrie.
- Citește live: poziția camionului, viteza, combustibilul, cursa activă, marfa, compania sursă
  și destinație, timpul rămas, avariile.
- Leagă datele live de Freight World: cursa activă apare pe pagina orașului de destinație,
  vremea reală la destinație, istoric de curse, statistici, eventual misiuni Freight World
  urmărite și verificate în joc.

### Modelul de monetizare (decis 2026-10-21): hibrid

Principiu: **datele și hărțile sunt gratuite, serviciul este plătit.**
Datele din joc vin din Truck Simulator Wiki (CC BY-SA 4.0) și nu pot fi ținute sub cheie,
iar jucătorii au plătit deja hărțile la SCS. Se vinde ce nu se poate copia:
funcțiile, conectarea live și uneltele.

*Gratuit — pentru toată lumea*
- Toate hărțile ATS și ETS2, inclusiv cele din DLC-uri.
- Toate paginile de oraș: poză, ora locală, vremea reală, companii, servicii, drumuri.
- Tabela de plecări de bază pentru fiecare oraș.
- Fișa cursei de bază.
- Planificatorul de rută de bază (de la A la B: ce marfă poți duce).
- **Mod „început de carieră”:** cine are doar jocul de bază primește automat curse filtrate
  pe harta de bază (ATS: California, Nevada și Arizona — Arizona e DLC gratuit; ETS2: harta de bază).
  Este o funcție de filtrare, nu un zid de plată.

*Premium — pentru jucători individuali*
- Conectarea live la ETS2 / ATS (aplicația companion, etapa 7).
- Istoric de curse, statistici, progres de carieră.
- Generator avansat: filtre detaliate, curse personalizate, tabele mai lungi.
- Notificări (ex. vreme rea la destinație, curse noi din orașul preferat).
- Preț mic și simplu: un singur plan pentru tot, nu plăți separate pe hărți sau DLC-uri.

*Abonament VTC — pentru companii virtuale (ex. TruckersMP)*
- Tabela companiei, dispecerat, convoaie, clasamente, rapoarte.

*Venituri secundare*
- Donații / susținere (Patreon, Ko-fi), mai ales în fazele timpurii.
- Reclame: deocamdată nu (strică designul și cer banner de cookie-uri, GDPR). La trafic mare,
  cel mult un singur sponsor discret, fără urmărire.

*Consecințe pentru arhitectură*
- Paginile de oraș rămân publice și indexabile pe Google (sursa principală de public).
- Fiecare depozit, marfă și oraș păstrează DLC-ul din care face parte,
  ca filtrul „început de carieră” și filtrul de DLC-uri deținute să funcționeze.
- Funcțiile premium se construiesc ca module separate, ca să poată fi activate
  pe bază de cont în etapa 7.
- Toate orașele, companiile, mărfurile și remorcile păstrează **ID-urile interne din joc**
  acolo unde wiki-ul le oferă (telemetria folosește aceste ID-uri).
- Generatorul și datele se scriu ca **modul separat**, refolosibil în aplicația companion.
- Toate serviciile externe trebuie să permită uz comercial (de aceea vremea vine de la MET Norway, CC BY 4.0).

*Condiții înainte de primul venit*
- Politica SCS Software pentru proiecte de fani monetizate, licența SCS Telemetry SDK și folosirea
  numelor ATS / ETS2 în promovare — verificate înainte de etapa 7.
- Condițiile TruckersMP pentru integrări (pentru abonamentul VTC).
- Formă legală pentru încasări (PFA sau SRL), termeni de utilizare, politică de confidențialitate.
- Plăți printr-un „merchant of record” (ex. Paddle, Lemon Squeezy), care se ocupă de TVA-ul UE.
- Atribuirea CC BY-SA (date) și CC BY (vreme) rămâne obligatorie peste tot.

### Ce NU facem (deocamdată)
- Nu facem un joc și nu simulăm condusul.
- Nu folosim logo-uri, capturi sau alte imagini din joc (sunt ale SCS Software).
- Nu facem conturi de utilizator, plăți sau backend propriu.
- Nu adăugăm orașe sau companii inventate (asta vine mult mai târziu, marcat separat).

---

## 2. Surse de date și licențe

| Ce | Sursă | Licență / condiții |
|---|---|---|
| Orașe, companii, depozite, mărfuri, remorci din joc | Truck Simulator Wiki — https://trucksimulator.wiki.gg (prin API-ul MediaWiki: `/api.php`) | **CC BY-SA 4.0** — atribuire obligatorie; setul de date publicat se distribuie sub aceeași licență |
| Ora locală | calculată în browser din `timezone_iana` (ex. `America/Los_Angeles`) | — |
| Vremea reală | MET Norway Locationforecast — https://api.met.no (fără cheie, prin funcția noastră `/api/weather/<oraș>`) | **CC BY 4.0** — atribuire obligatorie; uz comercial permis |
| Poze reale de oraș | Wikimedia Commons | licențe libere (CC BY, CC BY-SA, domeniu public) — autor + licență afișate pe pagină |
| Distanțe între orașe (estimare) | drumuri reale din OpenStreetMap, convertite la scara jocului | ODbL — atribuire „© OpenStreetMap contributors” |

**Atribuirea** apare în subsolul fiecărei pagini și în pagina „Despre / Surse”:
> Game data from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0.
> Weather data from MET Norway, CC BY 4.0. City photos from Wikimedia Commons (author and license on each photo).
> Not affiliated with SCS Software.

---

## 3. Scop inițial

- **Joc:** American Truck Simulator.
- **State:** California și Nevada — **toate orașele, companiile și depozitele din joc** pentru ele.
- **Mărfuri și remorci:** catalogul complet ATS (≈ 294 de mărfuri), pentru că e global.
- **Mai târziu:** restul hărții ATS, apoi ETS2, apoi orașe/companii extinse.

Comutatorul ATS / ETS2 apare în interfață de la început, dar ETS2 e marcat „în curând”.

---

## 4. Design

Designul pornește de la mockup-ul „Freight World – San Francisco” făcut cu Claude
și de la stilul **Airport Live** (întunecat, minimalist, foarte clar).

### Stil
- Fundal întunecat, carduri cu bordură fină, colțuri rotunjite (10–16 px).
- Accent **chihlimbar** pentru ore, tabela de plecări și butonul principal.
- Accent **albastru** pentru vreme rece, zăpadă, reefer.
- Tabela de plecări folosește font monospace, ca un panou real.
- Fără gradiente, fără emoji, fără efecte inutile.

### Culori (design tokens)
```
--bg:          #0B0F14   fundal pagină
--bg-header:   #0E131A   header, tabela de plecări
--panel:       #121821   carduri
--panel-deep:  #0F151D   carduri interioare
--hero:        #141C26   fundal hero / hartă
--border:      #1F2833
--border-input:#253141
--row-line:    #1A222C
--text:        #E6EDF3
--text-soft:   #B7C2CD
--text-muted:  #8B98A5   (trece contrastul 4.5:1 pe --panel)
--amber:       #F5A524   accent principal
--on-amber:    #1A1204   text pe butoane chihlimbar
--blue:        #7DBBFF   rece / zăpadă / reefer
--green:       #6FD39A   fără restricții / ok
```

### Tipografie
- **Inter** (400, 500, 600, 700) pentru interfață.
- **JetBrains Mono** (400, 500, 600) pentru ore, coduri, tabela de plecări.
- Titlu oraș: 52 px desktop, ~36 px telefon.

### Accesibilitate
- Butoane și linkuri reale (`<button>`, `<a>`), ținte de cel puțin 44 px.
- Contrast text minim 4.5:1.
- Tabelele late au scroll orizontal pe telefon, nu se strică layoutul.

---

## 5. Structura site-ului

| URL | Pagina |
|---|---|
| `/` | Acasă: căutare oraș, orașe recomandate, tabela unui oraș ales aleator |
| `/ats/` | Lista statelor și orașelor ATS |
| `/ats/ca/sacramento` | Pagina orașului |
| `/ats/ca/sacramento/board` | Tabela de plecări și sosiri (poate fi și o secțiune în pagina orașului) |
| `/ats/mission/<id>` | Fișa cursei |
| `/ats/company/<id>` | Pagina companiei (unde are depozite, ce acceptă/oferă) |
| `/about` | Despre proiect, surse, licențe |

Fiecare URL trebuie să funcționeze direct (bookmark, link trimis cuiva).

---

## 6. Arhitectură tehnică

- **Site static pe Netlify.** Fără server propriu la început; doar funcții Netlify mici acolo unde un serviciu extern o cere (vremea).
- **Datele din joc** stau ca fișiere JSON în repo, în `data/ats/`.
- **Scripturile** care colectează și curăță datele stau în `scripts/` și pot fi rulate din nou
  când apare un update de joc.
- **Vremea** vine de la MET Norway printr-o funcție Netlify (`/api/weather/<oraș>`, cache 20 de minute pe CDN): MET cere un User-Agent propriu, pe care browserul nu îl poate trimite.
- **Ora** se calculează în browser cu `Intl.DateTimeFormat` și `timezone_iana`.
- **Generatorul de curse** rulează în browser, pe baza fișierelor JSON.
- **Framework:** Claude Code propune varianta cea mai simplă care permite URL-uri curate
  pe oraș și o structură ușor de întreținut (de discutat la etapa 0).

### Fișiere de date
```
data/ats/cities.json      orașe: stat, DLC, depozite, servicii, drumuri, timezone_iana
data/ats/companies.json   companii: fișiere din joc, categorie, industrie, mărfuri pe tip de depozit
data/ats/cargo.json       mărfuri: greutate, valoare, UN, flag-uri, remorci, DLC
data/ats/trailers.json    remorci: nume, ce duc, dacă se pot cumpăra
data/ats/issues.json      probleme găsite în wiki, pentru verificare manuală
data/ats/distances.json   distanțe estimate între orașe (etapa 3)
data/photos.json          poze alese pe oraș: fișier Wikimedia, autor, licență, link
```

Fiecare fișier are un câmp `meta` cu sursa, licența, data colectării și atribuirea.

---

## 7. Generatorul de curse — logica

### Intrări
- depozitele din orașul ales și ce **oferă** fiecare;
- depozitele din alte orașe și ce **acceptă** fiecare;
- catalogul de mărfuri (greutate, valoare, remorci, hazmat, DLC);
- ora și ziua curentă în orașul respectiv;
- vremea reală la plecare și la destinație (MET Norway).

### Pașii pentru o cursă
1. Alege un depozit de plecare din oraș.
2. Alege o marfă pe care acel depozit o **oferă**.
3. Alege o destinație: un depozit din alt oraș care **acceptă** acea marfă.
4. Alege remorca dintre cele potrivite pentru marfă.
5. Alege greutatea în intervalul mărfii.
6. Calculează distanța (din `distances.json`), durata estimată și plata estimată
   (din distanță × valoarea mărfii; formula se calibrează și se notează aici).
7. Adaugă DLC-urile necesare (oraș de plecare, oraș de destinație, marfă).
8. Adaugă condițiile: vreme, hazmat, fragil, greu, noapte, weekend.

### „Mereu ceva diferit”, dar consecvent
- Generatorul folosește o **sămânță** formată din `oraș + data + ora`.
- Toată lumea care deschide tabela din Sacramento la 14:00 vede aceleași curse.
- La 15:00 apar curse noi.
- Tabela arată cursele pentru următoarele ~6 ore.

### Reguli de context (etapa 4)
- Vreme rea pe destinație (zăpadă, furtună) → plată mai mare, timp mai lung, avertisment.
- Noapte la destinație → notă despre odihnă.
- Weekend → mai puține curse din anumite industrii (de definit).
- Sezon → ponderi diferite pe mărfuri (ex. fructe vara, mărfuri de retail înainte de sărbători).
- Orice regulă nouă se notează în Jurnalul de decizii.

### Filtre pentru utilizator
- DLC-uri deținute (cursele care cer DLC-uri lipsă se ascund sau se marchează).
- Tip de remorcă, hazmat da/nu, distanță minimă/maximă.

---

## 8. Etapele

Fiecare etapă se face pe propriul branch, cu PR spre branch-ul principal al noii versiuni
(`v2-freight-world`), și primește un deploy preview pe Netlify.
O etapă e gata doar când toate criteriile ei sunt îndeplinite.

### Etapa 0 — Fundația
- Creează branch-ul `v2-freight-world` din branch-ul principal actual.
- Site-ul FOS actual rămâne neschimbat pe branch-ul principal.
- Alege și configurează structura proiectului (framework sau varianta simplă).
- Implementează design tokens, fonturi, header, footer cu atribuire, layout de bază.
- Pagina `/about` cu surse și licențe.

**Gata când:** deploy preview-ul arată un site gol, dar cu identitatea vizuală Freight World,
pe desktop și telefon.

### Etapa 1 — Datele ATS pentru California și Nevada
- Script de colectare prin API-ul MediaWiki (max. 1 cerere/secundă, User-Agent clar, cache local).
- Toate orașele CA + NV, toate companiile cu depozite acolo, catalogul complet de mărfuri,
  remorcile.
- Doar versiunea actuală a orașelor (se ignoră tab-urile „Before 1.xx”).
- Se păstrează **ID-urile interne din joc** (fișierele companiilor, numele interne ale mărfurilor
  și orașelor) acolo unde există — sunt necesare pentru aplicația companion (secțiunea 1).
  Unde wiki-ul nu le dă, câmpul rămâne `null` și se notează în `issues.json`.
- Necunoscut = `null`; contradicții → `issues.json`.
- README în `data/ats/` cu sursa, licența și cum se rulează scriptul.

**Gata când:** fișierele JSON sunt complete, valide, iar rezumatul arată câte orașe,
companii, mărfuri, remorci și probleme există.

### Etapa 2 — Paginile de oraș
- Lista orașelor `/ats/` și pagina fiecărui oraș `/ats/<stat>/<oraș>`.
- Hero cu poza reală (din `data/photos.json`), ora locală reală, vremea reală.
- Carduri: stat, DLC, servicii, drumuri, număr de depozite.
- Lista companiilor din oraș, fiecare cu ce acceptă și ce oferă.
- Pozele: alese manual o dată pe oraș, cu autor și licență afișate.
  Până la alegere, un placeholder elegant (nu o poză greșită).

**Gata când:** toate orașele CA + NV au pagină funcțională; ora și vremea sunt reale.

### Etapa 3 — Distanțe și generatorul de bază
- `distances.json`: distanțe estimate între orașe, calculate o singură dată din drumuri reale
  și convertite la scara jocului; marcate clar ca estimare.
- Generatorul de curse (secțiunea 7), fără reguli de vreme încă.
- Tabela de plecări pe pagina orașului, în stil aeroport.
- **Planificatorul de rută:** utilizatorul alege orașul (sau depozitul) de plecare și, opțional, destinația, și vede toate cursele reale posibile între ele (marfă, remorcă, greutate, DLC-uri, distanță, durată, plată), pe lângă tabela aleatoare.

**Gata când:** fiecare oraș are o tabelă care se schimbă la fiecare oră și conține doar
curse posibile în joc.

**Lansare în producție la finalul etapei 3:** eticheta git `fos-final` pe ultima versiune FOS de pe `main`,
apoi PR `v2-freight-world` → `main` cu deploy preview; după aprobarea proprietarului, Freight World
înlocuiește FOS pe `freight-operations-simulator.netlify.app`. Etapele următoare merg cu PR direct spre `main`.

### Etapa 4 — Fișa cursei și regulile de context
- Pagina `/ats/mission/<id>`: depozit de plecare, destinație, marfă, greutate, remorcă,
  camion recomandat, distanță, durată, plată estimată, DLC-uri, flag-uri.
- Vremea reală la plecare și la destinație.
- Regulile de context din secțiunea 7.
- Filtrul de DLC-uri deținute (salvat local în browser).

**Gata când:** orice cursă din tabelă deschide o fișă completă și corectă.

### Etapa 5 — Extinderea hărții
- **Arizona** (DLC gratuit) a fost adăugată pe 2026-10-22: harta de start ATS (California, Nevada, Arizona) e completă.
- Restul statelor ATS, stat cu stat, **după ce aplicația e mai completă** (decizia proprietarului, 2026-10-22).
- Apoi ETS2, cu aceeași structură de date (țări în loc de state).

### Etapa 6 — Extra (de discutat)
- Paginile companiilor, comparații între orașe, hartă interactivă.
- Funcții pentru companiile virtuale (VTC) de pe TruckersMP.
- Orașe și companii extinse, marcate clar ca „nu sunt în joc”.

### Etapa 7 — Aplicația companion (conectare live la ETS2 / ATS)
- Cercetare: SCS Telemetry SDK, pluginurile de telemetrie existente, cum ajung datele din joc
  într-o aplicație desktop și apoi pe site / telefon.
- Prototip: aplicație desktop care citește cursa activă și o arată în designul Freight World.
- Legarea cursei live de paginile de oraș și de misiunile generate (prin ID-urile din joc).
- Conturi și sincronizare (aici apare primul backend), apoi planurile premium și VTC.

**Gata când:** o cursă pornită în joc apare live în Freight World, cu vreme reală la destinație.

### Etapa 8 — Lansare și monetizare
- Verificările legale și de licență din secțiunea 1.
- Plan gratuit + premium + abonament VTC; pagină de prețuri; plăți.
- Lansare publică.

---

## 8b. Roadmap după lansare (actualizat 2026-10-22)

**Stare:** Etapele 0–4 sunt gata și live, plus Arizona (harta de start completă: 50 de orașe), paginile de companie (Etapa 6, prima parte) și harta în stil ATS. Etapele 5–8 de mai sus rămân direcția; fazele de mai jos sunt ordinea concretă de lucru.

Principii pentru toate fazele: nimic inventat (regulă reală, estimare marcată sau „simulat Freight World”); fără imagini, sunete sau logo-uri din joc; totul trece prin PR cu deploy preview și aprobarea proprietarului.

### Faza A — Senzația de joc (următoarea)
1. **Fișa cursei în stilul ofertei din joc:** card ca în piața de mărfuri (marfa, de la → la, distanță, termen, greutate), pictograme de abilități desenate de noi.
2. **Termen de livrare și urgență** (Standard / Important / Urgent), calculate din distanță, pauzele obligatorii și o marjă; marcate „simulat”.
3. **Plan de condus cu pauze (HOS, reguli FMCSA reale):** max. 11 h de condus, pauză 30 min după 8 h, odihnă 10 h; ora și locul pauzelor pe ruta de pe hartă.
4. **Timp în joc vs timp real** (scara de timp a jocului, ~20×) pe fișă.
5. **Harta: pictograme** — companiile/depozitele grupate la oraș (cu link), facilitățile orașului (garaj, service, cântar, dealer, hotel, recrutare), în stilul pictogramelor din joc; filtru de straturi.
6. **Lanț de curse:** după livrare, ce poți lua mai departe din orașul de destinație (spre orice sau spre un oraș ales).

### Faza B — Descoperire, căutare, creștere
1. **Pagini de marfă** (`/ats/cargo/<id>`), **de remorcă** și **de camion**, din datele existente.
2. **Căutare rapidă** în header (oraș, companie, marfă).
3. **SEO:** sitemap.xml, robots.txt, date structurate, imagini de previzualizare (Open Graph) pentru orașe, companii, mărfuri, fișe.
4. **Domeniu propriu** (singurul cost), **statistici fără cookie-uri**, **pagină / canal de feedback**.
5. **Favorite și istoric local** (în browser, fără cont).

### Faza C — Calibrare (când proprietarul trimite date din joc)
1. **Distanțe și durate:** factor de corecție din 4–5 curse notate (`data/ats/observations.json`; acum 1: LA → Phoenix, 531 km în joc vs 600 km estimat).
2. **Plata estimată:** formula de pe wiki calibrată pe 5–10 curse cu mărfuri diferite; afișată ca „plată estimată” cu baza ei.
3. **Greutățile lipsă** („???”, 31 de mărfuri), din joc.

### Faza D — Realism avansat
1. **Puncte pe drum:** benzinării, odihne, cântare, puncte de vedere între orașe (listele de pe wiki), pe hartă și pe rută.
2. **Cântare și limite de greutate** pe rută (80.000 lb total; avertisment „oversize / permis special”).
3. **Combinații de remorci legale pe stat** (tabelul Long Combination Vehicles de pe wiki).
4. **Combustibil pe rută** (estimare marcată) și unde alimentezi.
5. **Vremea pe tot traseul** (nu doar la capete) și **zi/noapte pe rută** (răsărit, apus).
6. **Design:** tabela de plecări cu efect split-flap (o singură animație, oprită la „mișcare redusă”); pagina de acasă cu harta și orașele cu plecări în ora curentă; **mod GPS** pe fișă (lista drumurilor și ieșirilor); **mod cabină** pentru al doilea ecran (ceas, vreme la destinație, rută).
7. **Mai multe limbi** (română, germană, poloneză), câte un fișier JSON.

### Faza E — Aplicația companion (Etapa 7; depinde de răspunsul SCS)
1. Cercetare: SCS Telemetry SDK, pluginurile existente, drumul datelor joc → aplicație desktop → site / telefon.
2. Prototip desktop care citește cursa activă și o arată în designul Freight World.
3. Legarea cursei live de paginile de oraș și de fișe (telemetria dă și ID-urile interne care lipsesc acum).
4. Primul backend: conturi, istoric, statistici.

### Faza F — Comunitate și VTC (Etapa 6, restul)
Comparații între orașe, „cele mai bune curse” dintr-un oraș, funcții pentru companii virtuale (TruckersMP: tabela companiei, convoaie, clasamente — după verificarea condițiilor TruckersMP).

### Faza G — Lansare comercială (Etapa 8)
Acordul SCS, formă legală (PFA / SRL), termeni și politică de confidențialitate, plăți prin merchant of record (Paddle / Lemon Squeezy), pachetele gratuit / Premium / VTC; donațiile (Ko-fi / Patreon) pot porni oricând.

### Faza H — Extinderea hărții (Etapa 5, când aplicația e mai completă)
Restul statelor ATS, apoi ETS2 (aceeași structură de date; un stat sau o țară nouă = o intrare în `scope.json` + colectare, poze, distanțe, hartă).

### În paralel, oricând
- Răspunsul SCS (harta reală, datele din joc, SDK, monetizare) poate schimba fazele A5, D1 și E.
- Lucruri mici: poze pentru Santa Maria și San Simon, corecturi pe wiki pentru `issues.json`, testare pe telefon real și cu cititor de ecran, fișa pentru imprimare.
- Proprietarul: curse notate din joc (Faza C), ștergerea cheii Geoapify din Netlify.

## 9. Mod de lucru pentru Claude Code

- Citește acest fișier la începutul fiecărei etape.
- **Înainte de a începe o etapă**, spune planul în câteva rânduri.
- **Întreabă** înainte de orice decizie importantă (framework, structură de date,
  ștergerea a ceva existent).
- **Povestește** pe scurt ce faci, pe parcurs.
- Lucrează pe branch-uri separate, deschide PR-uri, folosește deploy preview-urile Netlify.
- Nu modifica branch-ul principal (`main`, site-ul FOS) până la lansarea de la finalul etapei 3.
- Nu adăuga dependențe sau servicii plătite.
- La final de etapă: rezumat clar (ce s-a făcut, ce lipsește, ce probleme au apărut)
  și actualizează Jurnalul de decizii de mai jos.

---

## 10. Jurnal de decizii

| Data | Decizie |
|---|---|
| 2026-10-21 | FOS devine Freight World: generator de curse ATS/ETS2 + pagini de oraș vii. |
| 2026-10-21 | Datele din joc vin din Truck Simulator Wiki (CC BY-SA 4.0), prin API-ul MediaWiki. |
| 2026-10-21 | Scop inițial: ATS, California și Nevada, tot ce există în joc pentru ele. |
| 2026-10-21 | Ora locală, vremea reală (Open-Meteo) și poza reală (Wikimedia) rămân pe fiecare oraș. |
| 2026-10-21 | Pozele de oraș se aleg manual și se salvează, nu se caută automat la fiecare afișare. |
| 2026-10-21 | Lucrul se face în repo-ul FOS existent, pe branch-ul `v2-freight-world`; site-ul actual rămâne neschimbat. |
| 2026-10-21 | Obiectiv: produs monetizat (premium, abonament VTC, donații, eventual reclame), cu direcția principală o aplicație companion conectată live la ETS2/ATS prin SCS Telemetry SDK. |
| 2026-10-21 | Datele păstrează ID-urile interne din joc, ca să poată fi legate de telemetria live. |
| 2026-10-21 | Etapa 0: structura proiectului este **Astro** (site static, versiunea 7.3.8 fixată), nu HTML simplu: generează câte o pagină HTML pentru fiecare URL (`/ats/ca/sacramento`) din fișierele JSON, deci linkurile directe, titlurile și previzualizările merg; header/footer scrise o singură dată; generatorul rămâne modul JS separat, testat cu `node --test`. Netlify: `npm run build`, publică `dist/`, Node 24. |
| 2026-10-21 | Interfața Freight World este în **engleză**, cu toate textele în `src/i18n/en.json` (româna se poate adăuga ca fișier separat). O cheie lipsă oprește build-ul. |
| 2026-10-21 | Pe `v2-freight-world`, codul FOS a fost mutat neschimbat în `legacy/fos/` (doar referință, nu se publică); `main` și site-ul FOS rămân neschimbate. Fonturile au trecut în `public/fonts/`. |
| 2026-10-21 | `AGENTS.md` rescris pentru Freight World (regulile valabile din FOS păstrate: date nesigure = `null`, licențe, fără API-uri plătite, accesibilitate); planul se numește acum `DEVELOPMENT_PLAN.md`. Versiunea Freight World pornește de la 2.0.0-alpha.1. |
| 2026-10-21 | Etapa 1: intră doar cele **34 de orașe active** din CA și NV; cele 4 marcate pe wiki ca scoase din joc (Carlsbad, Hornbrook, San Rafael, Oakdale) și Fallon (marcat „viitor”) sunt excluse. |
| 2026-10-21 | Coordonatele orașelor (pentru vreme) vin din **Wikidata** (CC0): articolul Wikipedia „Oraș, Stat” → elementul Wikidata → P625, acceptat doar dacă Wikidata îl pune în acel stat. Sunt coordonatele orașului real, nu poziția din joc. Wikidata e adăugată pe `/about`. |
| 2026-10-21 | Pentru pagina orașului se păstrează **tot ce oferă wiki-ul, ca liste structurate** (date din infobox, depozite, facilități, drumuri, orașe vecine, repere), fără paragrafe copiate; fiecare oraș are link spre pagina wiki. |
| 2026-10-21 | Sursa principală pentru depozite este **pagina companiei** (are ID-urile interne pe tip de depozit și mărfurile acceptate/oferite); pagina orașului servește la verificare, orice diferență intră în `data/ats/issues.json`. |
| 2026-10-21 | Structura fișierelor din `data/ats/` confirmată (cities, companies, cargo, trailers, issues, cu `meta` în fiecare). Remorcile au două niveluri: **tipurile** din lista de mărfuri și **modelele** de la dealer, legate după nume sau după mărfurile comune (suprapunere Jaccard ≥ 0,5). Statele, categoriile wiki și fusurile orare stau în `data/ats/scope.json`. |
| 2026-10-21 | SCS a anunțat în iulie 2026 un „Nevada Rework”; datele pentru Nevada se vor schimba la acel update. Scriptul se rulează din nou cu `--refresh`. |
| 2026-10-21 | Corecturi pentru numele de mărfuri care nu se potrivesc, scrise de mână și aprobate de proprietar, în `data/ats/aliases.json` (8 greșeli de tipar sau formulări diferite). Cele 5 nume generice (Pickups, Boom Lift, Concrete Tubes, Lumber, Recreational Vehicle) primesc toate variantele din catalog și sunt marcate (`genericNames`). |
| 2026-10-21 | Remorcile fără pagină de dealer primesc pagina wiki „<Tip> Trailer” dacă există (majoritatea nu se pot cumpăra). Prețul nu e necesar pentru curse. |
| 2026-10-21 | Decizii amânate: mărfurile fără greutate și numărul de companii din infobox se tratează prin reguli de afișare în Etapele 2–3 (marfa fără greutate nu intră în curse sau apare „necunoscută”; pe pagina orașului se arată numărul de depozite avute). ID-urile interne pentru orașe și mărfuri se leagă în Etapa 7, din telemetria jocului. |
| 2026-10-21 | **Selecția rutei de către utilizator** (pe lângă tabela aleatoare) se adaugă în Etapa 3, ca planificator complet: plecare (oraș sau depozit), destinație opțională, toate cursele reale posibile între ele, cu distanță, durată și plată. |
| 2026-10-21 | Unități: implicit ca în joc pentru ATS (°F, mile, lb), cu comutator metric (°C, km, kg) salvat în browser. |
| 2026-10-21 | Pozele orașelor: Claude propune 1–4 candidați pe oraș de pe Wikimedia Commons (licență liberă, autor, ≥ 1200 px; `data/photo-candidates.json`), proprietarul a decis ca Claude să aleagă cea mai bună poză pentru fiecare oraș (orizontală, arată orașul, clară), cu motivul notat; alegerea intră în `data/photos.json`. Fără poză potrivită rămâne placeholder. Proprietarul poate cere oricând altă poză. |
| 2026-10-21 | Etapa 2: pozele au fost alese de Claude, uitându-se la fiecare candidată (33 din 34 de orașe; Santa Maria rămâne cu placeholder, are doar un banner foarte îngust). Numărul de depozite afișat vine din paginile companiilor. Pagina orașului nu folosește gradiente: titlul stă pe o bandă solidă semitransparentă peste poză. |
| 2026-10-22 | **Modelul de monetizare: hibrid** — datele și hărțile gratuite, serviciul plătit (premium individual, abonament VTC, donații). Detalii și condiții în secțiunea 1. Reclamele se amână. Planificatorul de rută de bază rămâne gratuit. |
| 2026-10-22 | Vremea trece de la Open-Meteo (gratuit doar necomercial) la **MET Norway** (CC BY 4.0, uz comercial permis), printr-o funcție Netlify cu cache, portată din FOS. Atribuirea din footer se schimbă în consecință. Temperatura resimțită dispare (MET nu o oferă). |
| 2026-10-22 | Freight World înlocuiește FOS în producție **la finalul Etapei 3**, nu acum. Codul FOS se șterge din proiect (`legacy/fos/`); rămâne recuperabil din istoria git, iar la lansare se pune eticheta `fos-final` pe `main`. |
| 2026-10-22 | Etapa 3: distanțele între orașe = drumul real cel mai scurt pe OpenStreetMap (serverul public OSRM, o singură cerere pentru toate cele 1.122 de perechi), marcate ca estimare. Motiv: ATS e la scara 1:20 cu timpul de ~20× mai rapid (blog SCS), deci distanțele afișate în joc ar trebui să fie apropiate de cele reale; proprietarul verifică 4–5 rute în joc, iar o diferență constantă devine factor de corecție. Durata = distanța la 55 mph (limita pentru camioane în California). |
| 2026-10-22 | **Plata nu se afișează** în Etapa 3: structura formulei e documentată (wiki Economy, după forumul SCS), dar lipsesc numărul de unități pe cursă și constantele ATS; fișierele extrase din joc nu se folosesc până la verificarea politicii SCS. |
| 2026-10-22 | Tabela de plecări: 12 curse în următoarele 6 ore, sămânța = oraș + data și ora locală; mărfurile fără greutate cunoscută nu apar pe tabelă (rămân în planificator, cu „greutate necunoscută”). Pe pagina de acasă, orașul tabelei se schimbă în fiecare oră (sămânță UTC), la fel pentru toată lumea. |
| 2026-10-22 | Planificatorul de rută: pagina `/ats/planner` (plecare = oraș sau depozit, destinație opțională, filtre: doar jocul de bază, ADR, remorcă), cu starea în adresă; buton pe fiecare pagină de oraș. Gratuit, conform modelului de monetizare. |
| 2026-10-22 | Butonul **„Generate a job”** (o cursă reală aleatorie, cu codul ei în adresă) intră înainte de lansare, la cererea proprietarului: pe acasă (orice oraș sau unul ales) și pe fiecare pagină de oraș. Fișa completă a cursei rămâne Etapa 4. |
| 2026-10-22 | **Lansare:** Freight World a înlocuit FOS în producție (PR #16, aprobat de proprietar). FOS rămâne recuperabil din eticheta git `fos-final`. De acum, PR-urile merg direct spre `main`. |
| 2026-10-22 | Etapa 4: vremea rea la plecare sau destinație dă **doar avertisment**, fără întârzieri inventate. Regulile de weekend și sezon se **amână** (jocul nu are date pentru ele). |
| 2026-10-22 | Camioanele ATS se colectează de pe wiki (19 lansate; cele anunțate rămân pe dinafară). **Camionul recomandat** e o regulă Freight World, afișată ca „simulat”: ≥ 400 CP până la 25.000 lb, ≥ 450 CP până la 45.000 lb, ≥ 500 CP peste, ≥ 550 CP pentru marfă „heavy”; întâi mărcile cu dealer în orașul de plecare; fără camioane electrice (lipsesc datele de autonomie). |
| 2026-10-22 | ID-ul fișei de cursă e format din ID-uri stabile (oraș, depozit, marfă, destinație, remorcă, greutate), ca linkurile să rămână valabile după o reîmprospătare a datelor. „My DLCs” se salvează doar în browser; fără o alegere salvată nu se filtrează nimic. |
| 2026-10-22 | Se adaugă **doar Arizona** acum, ca harta de start (jocul de bază + DLC-ul gratuit) să fie completă; celelalte state vin după ce aplicația e mai completă. Arizona folosește fusul `America/Phoenix` (fără ora de vară), definit ca excepție pe stat în `scope.json`. San Simon rămâne fără poză (nicio poză liberă potrivită pe Commons). |
| 2026-10-22 | **Paginile de companie** (Etapa 6, prima parte): doar cele 67 de companii cu depozite pe harta de start; cu secțiunile calculate „Where its cargo goes” și „Who supplies it” (doar legături posibile în joc). Fără logo-uri (grafică din joc): monogram generat. Cursele văzute în joc de proprietar se notează în `data/ats/observations.json` pentru calibrare (prima: LA → Phoenix, 531 km în joc vs 600 km estimat). |
| 2026-10-22 | **Harta**: varianta „în stil SCS”, desenată de noi, cât mai apropiată de harta din ATS (după capturile proprietarului, folosite doar ca referință, nepuse în proiect). Date: Natural Earth 1:10m (domeniu public); drumurile sunt cele reale, rețeaua din joc poate diferi. Rutele de pe fișă urmează drumurile (cel mai scurt drum pe graful hărții). Proprietarul a cerut acordul SCS (info@scssoft.com) pentru harta reală, datele din joc, SDK-ul de telemetrie și monetizare; dacă acceptă, harta poate fi înlocuită. |
| 2026-10-22 | **Roadmap după lansare** (secțiunea 8b): fazele A (senzația de joc) → B (descoperire, SEO) → C (calibrare, când vin date din joc) → D (realism avansat) → E (aplicația companion, după răspunsul SCS) → F (comunitate, VTC) → G (comercial) → H (alte state, ETS2). Propunerile noi de realism și design (termen și urgență, HOS, lanț de curse, pictograme, split-flap, mod GPS și cabină, pagini de marfă, căutare) sunt incluse în aceste faze. |
