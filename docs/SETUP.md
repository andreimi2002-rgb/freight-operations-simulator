# Instalare și conectare

## 1. Pluginul de telemetrie (deja instalat)

`scs-telemetry.dll` (RenCloud scs-sdk-plugin, revizia 12) se află în:

- `...\Euro Truck Simulator 2\bin\win_x64\plugins\`
- `...\American Truck Simulator\bin\win_x64\plugins\`

La pornire, jocul afișează un mesaj că folosește SDK-ul avansat. Apasă OK. Bridge-ul citește memoria partajată `Local\SCSTelemetry` pe care o creează pluginul.

## 2. Bridge-ul pe PC

```bash
npm install
```

```bash
npm run build
```

```bash
npm run bridge
```

Opțiuni:

| Opțiune | Efect |
| --- | --- |
| `--mode live` (implicit) / `demo` / `replay --file <nume>` | sursa datelor |
| `--port 8787` sau `PORT=8787` | portul (8787 implicit) |
| `--no-record` sau `TRUCKSIM_RECORD=off` | oprește înregistrarea sesiunilor |
| `TRUCKSIM_PUBLIC_URL=https://…ts.net` | afișează link-uri de împerechere HTTPS |
| `TRUCKSIM_ORIGINS` | origini permise (implicit: Netlify + localhost:5173) |
| `ANTHROPIC_API_KEY`, `TRUCKSIM_AI_MODEL` | copilot cu Claude (mai simplu: Setări → Copilot AI în aplicație) |

Pe Windows, dacă PowerShell refuză `npm` („running scripts is disabled”), pornește bridge-ul direct, din folderul proiectului:

```bash
node apps/bridge/src/main.ts --port 8788
```

Tokenul se generează la prima pornire și se salvează în `var/bridge.json` (ignorat de git). Ca să-l schimbi, șterge fișierul.

## 3. iPhone / iPad în aceeași rețea (HTTP, fără microfon)

Deschide link-ul de împerechere `http://192.168.x.x:8787/#pair=…` afișat de bridge. Apoi, din Safari: Share → Add to Home Screen.

Pe HTTP merg dashboard-ul, harta, cursa, wiki-ul și cariera. Microfonul nu merge: Safari îl permite doar pe HTTPS.

## 4. HTTPS cu Tailscale (recomandat: microfon + aplicația de pe Netlify)

1. Instalează Tailscale pe PC și pe iPhone/iPad, cu același cont.
2. Pe PC, într-un terminal:
   ```bash
   tailscale serve --bg 8787
   ```
   Tailscale afișează o adresă de forma `https://numele-pc.tail1234.ts.net`. E privată: o văd doar dispozitivele tale.
3. Pornește bridge-ul cu adresa publică, ca să-ți afișeze link-urile:
   ```bash
   set TRUCKSIM_PUBLIC_URL=https://numele-pc.tail1234.ts.net && npm run bridge
   ```
4. Pe iPhone deschide unul dintre link-uri:
   - `https://numele-pc…ts.net/#pair=…`: aplicația servită de PC.
   - `https://freight-operations-simulator.netlify.app/#pair=…`: aplicația de pe Netlify, conectată la PC.

Nu deschidem porturi în router și nu expunem nimic public.

## 5. Netlify

Site-ul `freight-operations-simulator` publică `apps/web/dist` (vezi `netlify.toml`). Netlify găzduiește doar interfața. Telemetria rulează pe PC.

## 6. Înregistrări și replay

Fiecare sesiune live se salvează în `recordings/AAAA-LL-ZZ_HHMM_<joc>.jsonl.gz`: un snapshot la 500 ms plus toate evenimentele. Audio nu se înregistrează. Le poți reda din aplicație (Setări → Mod bridge) sau așa:

```bash
node apps/bridge/src/main.ts --mode replay --file 2026-11-18_2010_ets2.jsonl.gz
```
