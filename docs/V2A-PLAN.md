# Etapa 2A — UN/LOCODE, distanță pe țări, puncte de frontieră

Stare: în lucru. Branch: `feature/v2a-borders-locode` (din `main`, după PR #8). Fără locuri OSM (acelea sunt 2B).
Decizii (recomandările asistentului, acceptate de proprietar): UN/LOCODE din oglinda GitHub `datasets/un-locode` (cu avertismentul de licență); punctul de frontieră se arată cu numele public din OSM, iar fără nume ca „Punct de frontieră X–Y”; fără nume de firme (regula din ROADMAP).

## 1. Distanța pe țări
- Date: **Natural Earth** 10m, granițele țărilor (domeniu public), extrase de `scripts/build-borders.mjs` pentru țările active și vecinii lor, simplificate (~200 m) în `src/data/geo/borders.json`; încărcate de aplicație la prima generare.
- Motor: `src/engine/border-split.mjs` împarte geometria traseului la granițe (țara fiecărui vârf, trecerea găsită prin bisecție), calculează lungimea pe țară și o aplică distanței furnizorului (procente din geometrie × distanța din rutare, pentru că geometria e eșantionată). Fapt „calculat” cu formulă, intrări și date folosite.

## 2. Puncte de frontieră
- Date: `scripts/build-border-crossings.mjs` ia din OpenStreetMap (Overpass, cu reîncercări) \`barrier=border_control\` și \`amenity=customs\` pentru țările active, grupează elementele aflate la sub 500 m și scrie \`src/data/geo/border-crossings.json\` (nume public dacă există, ID-uri OSM, coordonate).
- Motor: la fiecare trecere găsită în geometrie se caută cel mai apropiat punct (≤ 5 km); fără potrivire: „Punct de frontieră România–Ungaria”. Regimul: granița dintre două țări Schengen este **internă** (fără control); lista Schengen e dată (\`src/data/geo/schengen.json\`, sursă și dată). Nu se estimează timpi de așteptare.
- UI: rândul „Punct de frontieră” (și „Distanță pe țări”) devine real, în Hartă și rută; pe hartă apar marcajele trecerilor; în Prezentare, cardul „Detalii rută” arată frontiera.

## 3. UN/LOCODE
- \`scripts/build-locodes.mjs\` descarcă lista (oglinda GitHub), potrivește orașele din catalog după țară, nume normalizat și coordonate (≤ 25 km; ambiguu = fără cod) și scrie \`src/data/places/locodes.json\`. Orașele fără potrivire păstrează codul provizoriu.
- Antetul arată partea de locație (3 litere) a codului; când originea și destinația ar avea aceeași parte, se arată codurile complete; codul complet apare în drawer.
- **Licență:** statutul de reutilizare al datelor UN/LOCODE e neclar (declarat chiar de oglindă); se păstrează doar codurile necesare, cu sursa și avertismentul în DATA-LICENSES.

## Teste
Împărțirea pe țări cu poligoane sintetice (rezultate calculate independent) și pe granițele reale; trecere unică, de două ori, prin țări terțe, în afara poligoanelor; gruparea punctelor de frontieră; regimul Schengen; potrivirea LOCODE (ex. HUBUD, BGSOF, ROARW) și fallback; faptele noi din \`Load\` valide; UI în browser (tab Hartă și rută, marcaje, antet).
