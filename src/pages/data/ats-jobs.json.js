// Static file /data/ats-jobs.json: the packed job dataset the browser uses for the
// departures boards and the route planner (built from data/ats/ at build time).
import { cities, companies, cargo, trailers, distances } from '../../lib/data.mjs';
import { buildJobDataset, packJobDataset } from '../../engine/dataset.mjs';

export function GET() {
  const packed = packJobDataset(buildJobDataset({ cities, companies, cargo, trailers, distances }));
  return new Response(JSON.stringify(packed), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
