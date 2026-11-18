// Extracts game data from local installations: node apps/bridge/src/gamedata/cli.ts [ets2|ats]
import { refreshGameData } from './store.ts';

const only = process.argv[2] as 'ets2' | 'ats' | undefined;
const results = await refreshGameData({ force: true, only });
for (const r of results) {
  if (!r.data) {
    console.log(`${r.game}: ${r.error}`);
    continue;
  }
  const d = r.data;
  console.log(
    `${r.game}: ${d.countries.length} countries, ${d.cities.length} cities, ${d.companies.length} companies, ${d.cargo.length} cargo, ${d.meta.dlcs.length} DLC archives (${r.ms} ms)`,
  );
  for (const w of r.warnings) console.log(`  warning: ${w}`);
}
