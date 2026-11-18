# Validare pe jocul real

Codul e testat pe date sintetice, pe offset-urile din header-ul oficial al pluginului. Lucrurile de mai jos se pot confirma doar cu jocul pornit. Pentru fiecare, notează rezultatul și versiunea jocului.

## Primul test (15 minute)

1. `npm run bridge` cu ETS2 pornit și un profil încărcat.
2. În consolă trebuie să apară `[event] game.connected (ets2)`.
3. Deschide aplicația și verifică pe ecranul Camion:
   - [ ] viteza egală cu cea din bord, în km/h;
   - [ ] combustibilul (L) egal cu cel din joc;
   - [ ] treapta afișată egală cu cea din bord.
4. Acceptă o cursă (ideal Brașov / Subse → Ruse, Chocolate). Pe ecranul Cursă verifică:
   - [ ] marfa, orașele și companiile;
   - [ ] plata;
   - [ ] termenul.
5. Setează GPS-ul și verifică:
   - [ ] **distanța rămasă**: e egală cu cea din GPS-ul jocului sau diferă de ea de ~19 ori (scala lumii)?
   - [ ] **timpul rămas** (`navigation.timeMin`): sunt minute de joc sau minute reale? Compară ETA-ul afișat cu cel din GPS-ul jocului.
6. [ ] **Odometrul**: crește cu km „de bord” sau cu km reali din lume?
7. [ ] **Direcția pe hartă**: camionul virează la stânga, săgeata virează la stânga.
8. [ ] **Odihna** (`restStop`): în minute de joc? Ce valoare are când oboseala e dezactivată?
9. Livrează cursa:
   - [ ] apare o singură dată în Carieră, cu câștig și XP;
   - [ ] în `recordings/` există fișierul sesiunii.
10. Ieși din joc:
    - [ ] în maximum 10 s, aplicația arată „Joc oprit” și nu mai afișează valori.
11. Repetă pe scurt cu ATS:
    - [ ] unități mph / galoane;
    - [ ] legăturile către fișele wiki (companie, oraș, marfă) din ecranul Cursă.

## Pentru fiecare problemă

Trimite fișierul din `recordings/`. Din el pot reproduce exact situația în replay și pot scrie un test.

## Cunoscut / de verificat

| Element | Ipoteza curentă | Unde se corectează |
| --- | --- | --- |
| `routeDistance` | metri, aceeași valoare ca în GPS-ul jocului | `apps/bridge/src/normalize.ts` |
| `routeTime` | secunde de joc → `timeMin` = minute de joc | `normalize.ts`, `MapView.tsx` |
| `rotationX` | 0..1, 0 = nord, sens trigonometric | `normalize.ts` |
| `restStop` | minute de joc până la odihnă; 0 = necunoscut | `normalize.ts` |
| ID companie (ATS) | egal cu `defIds` din `data/ats/companies.json` | `packages/core/src/wiki.ts` |
| Scala demo | 1 km de joc ≈ 1/19 km în lume | `packages/core/src/demo.ts` |
