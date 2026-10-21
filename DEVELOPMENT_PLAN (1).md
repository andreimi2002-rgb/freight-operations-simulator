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

**Alte căi de monetizare (de prioritizat mai târziu):**
- **Premium** pentru utilizatori individuali: cursa live, istoric, statistici, filtre avansate,
  toate hărțile.
- **Abonament pentru companii virtuale (VTC)** de pe TruckersMP: tabela companiei, dispecerat,
  convoaie, clasamente, rapoarte.
- **Donații / susținere** (Patreon, Ko-fi) în fazele timpurii.
- **Reclame discrete** pe varianta gratuită, doar dacă nu strică designul.

**Ce înseamnă asta pentru arhitectură, încă de acum:**
- Toate orașele, companiile, mărfurile și remorcile păstrează **ID-urile interne din joc**
  (ex. fișierele companiilor, ca `oak_port`, numele interne ale mărfurilor și orașelor) acolo unde
  wiki-ul le oferă. Telemetria din joc folosește aceste ID-uri, iar fără ele datele live
  nu pot fi legate de paginile Freight World.
- Generatorul și datele se scriu ca **modul separat**, refolosibil mai târziu în aplicația companion.
- **Înainte de lansarea comercială se verifică:** condițiile comerciale Open-Meteo (uzul comercial
  cere de regulă plan plătit sau alternativă), politica SCS Software privind proiectele de fani
  monetizate, condițiile TruckersMP pentru integrări, iar atribuirea CC BY-SA rămâne obligatorie.

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
| Vremea reală | Open-Meteo — https://open-meteo.com (fără cheie) | gratuit pentru uz necomercial; **de verificat condițiile înainte de monetizare** |
| Poze reale de oraș | Wikimedia Commons | licențe libere (CC BY, CC BY-SA, domeniu public) — autor + licență afișate pe pagină |
| Distanțe între orașe (estimare) | drumuri reale din OpenStreetMap, convertite la scara jocului | ODbL — atribuire „© OpenStreetMap contributors” |

**Atribuirea** apare în subsolul fiecărei pagini și în pagina „Despre / Surse”:
> Game data from Truck Simulator Wiki contributors (trucksimulator.wiki.gg), CC BY-SA 4.0.
> Weather by Open-Meteo. City photos from Wikimedia Commons (author and license on each photo).
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

- **Site static pe Netlify.** Fără server propriu la început.
- **Datele din joc** stau ca fișiere JSON în repo, în `data/ats/`.
- **Scripturile** care colectează și curăță datele stau în `scripts/` și pot fi rulate din nou
  când apare un update de joc.
- **Vremea** se cere direct din browser de la Open-Meteo, cu cache scurt (ex. 15 minute).
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
- vremea reală la plecare și la destinație (Open-Meteo).

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

**Gata când:** fiecare oraș are o tabelă care se schimbă la fiecare oră și conține doar
curse posibile în joc.

### Etapa 4 — Fișa cursei și regulile de context
- Pagina `/ats/mission/<id>`: depozit de plecare, destinație, marfă, greutate, remorcă,
  camion recomandat, distanță, durată, plată estimată, DLC-uri, flag-uri.
- Vremea reală la plecare și la destinație.
- Regulile de context din secțiunea 7.
- Filtrul de DLC-uri deținute (salvat local în browser).

**Gata când:** orice cursă din tabelă deschide o fișă completă și corectă.

### Etapa 5 — Extinderea hărții
- Restul statelor ATS, stat cu stat.
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

## 9. Mod de lucru pentru Claude Code

- Citește acest fișier la începutul fiecărei etape.
- **Înainte de a începe o etapă**, spune planul în câteva rânduri.
- **Întreabă** înainte de orice decizie importantă (framework, structură de date,
  ștergerea a ceva existent).
- **Povestește** pe scurt ce faci, pe parcurs.
- Lucrează pe branch-uri separate, deschide PR-uri, folosește deploy preview-urile Netlify.
- Nu modifica branch-ul principal al site-ului FOS actual.
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
