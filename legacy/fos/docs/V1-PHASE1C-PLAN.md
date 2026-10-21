# V1 · Etapa 1C — Tab-uri + țările ca date (un singur PR)

Stare: implementat, în revizie (proprietarul a cerut A și B în același PR). Branch: `feature/v1-phase1c` (din `docs/roadmap`).
Decizii luate (recomandările asistentului, acceptate implicit): antetul cursei rămâne pe toate tab-urile; tab-ul activ în adresă (`#cargo`, prin `replaceState`); orele de pe parcurs în ora locală a plecării (cu UTC), sosirea în ora destinației; fișiere de orașe separate pe țară.

## B. Țările devin date
- `src/data/countries.mjs`: lista țărilor active (RO, HU, BG) cu fusuri orare, capitala (verificare la import) și pragul minim de orașe. Motorul (`validateLoad`, `generateLoad`) citește lista de aici; poate primi și o listă explicită (pentru teste și pachete de țară).
- Un fișier de orașe pe țară: `src/data/places/cities-RO.json` etc. Importatorul primește țările ca argument (implicit cele active) și refuză să scrie un rezultat greșit. `cities-ro-hu-bg.json` dispare.
- Aplicația și serverul local încarcă fișierele țărilor active; fiecare oraș își păstrează data importului.
- Textele cu „România, Ungaria și Bulgaria” devin un text cu parametru `{countries}` (`Intl.ListFormat`).
- Funcția de rutare primește limba de la client (nu mai e `ro` fix).
- Teste: o țară nouă (fixture) trece doar prin date; niciun cod din motor/UI/scripturi nu mai conține lista fixă a țărilor.
- Modelul `Load` rămâne versiunea 3: cursele salvate rămân valide.

## A. Tab-uri
Antetul cursei sus, apoi bara cu 8 tab-uri: **Prezentare, Hartă și rută, Marfă, Camion și trailer, Program și pauze, Costuri, Documente, Surse și calcule**. Ce lipsește apare „Indisponibil încă — Etapa N” (rânduri cu proveniență, drawer, motiv). Fără Flotă, Companii, Statistici, Evenimente; fără poze; fără strat Satelit.

- **Grupare:** fiecare rând al fișei aparține unui singur tab; rândurile viitoare (cod CN, volum, camion, taxe, documente etc.) sunt rânduri „indisponibile” definite în view-model, cu etapa și motivul. „Surse și calcule” arată toate rândurile, legenda și „De verificat”.
- **Cronologie** în „Program și pauze”: modul nou `src/engine/schedule.mjs`, calculat din fereastra de încărcare și segmentele de tranzit existente (plecarea la sfârșitul ferestrei de încărcare), ca fapt „calculat” cu formulă și intrări.
- **Hartă:** un singur MapLibre, mutat între „Prezentare” (compactă) și „Hartă și rută” (mare), cu `resize` și refit; instantaneul pentru print rămâne valabil și când harta nu e vizibilă.
- **Accesibilitate:** model WAI-ARIA tablist (săgeți, Home/End, tabindex), pe telefon bara se derulează lateral și rămâne vizibilă.
- **Neschimbate:** calculele, drawer-ul de detalii, proveniența, printul pe o pagină, istoricul.

## Teste
Fiecare rând în exact un tab; fiecare tab are conținut; fiecare rând indisponibil are etapă, motiv și traduceri; cronologia (plecare = sfârșit încărcare, sosire = plecare + tranzit, ordine, fusuri orare); țară nouă prin date; browser: tastatură, adresă, hartă în ambele tab-uri, print din orice tab, fără scroll lateral la 320/390 px, fără traduceri lipsă.
