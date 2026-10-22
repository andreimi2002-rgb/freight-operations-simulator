// Static file /data/search.json: the header search index (built from data/ats/).
import { cities, companies, cargo, trailers, trucks, stateByCode } from '../../lib/data.mjs';
import { buildSearchIndex } from '../../lib/search.mjs';
import en from '../../i18n/en.json';

export function GET() {
  const index = buildSearchIndex({ cities, companies, cargo, trailers, trucks, stateName: (code) => stateByCode.get(code)?.name ?? code,
    dlcName: (dlc) => (dlc === 'base' ? en.catalog.baseGame : en.dlcNames[dlc] ?? dlc) });
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
