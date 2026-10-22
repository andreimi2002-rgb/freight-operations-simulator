// Static file /data/ats-map.json: base layers of the map (built by scripts/map/build-map.mjs).
import map from '../../../data/map/ats-map.json';

export function GET() {
  return new Response(JSON.stringify(map), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
