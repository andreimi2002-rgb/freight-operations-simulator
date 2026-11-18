# Înregistrări

Bridge-ul salvează aici fiecare sesiune live (`*.jsonl.gz`). Fișierele sunt ignorate de git, cu excepția celor din `samples/`.

Format: prima linie `{"header":{…}}`, apoi câte o linie `{"t": ms de la start, "s": Snapshot, "e": [GameEvent]}`.
