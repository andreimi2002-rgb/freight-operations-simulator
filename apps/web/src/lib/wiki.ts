import { useEffect, useState } from 'react';
import { WikiIndex, type WikiData } from '@trucksim/core';

/** Loads the ATS game data lazily (about 2 MB, in its own chunks). */
let promise: Promise<WikiIndex> | null = null;
let loaded: WikiIndex | null = null;

export function loadWiki(): Promise<WikiIndex> {
  promise ??= Promise.all([
    import('@data/ats/cities.json'),
    import('@data/ats/companies.json'),
    import('@data/ats/cargo.json'),
    import('@data/ats/trucks.json'),
    import('@data/ats/trailers.json'),
  ]).then(([cities, companies, cargo, trucks, trailers]) => {
    const data = {
      meta: cities.default.meta,
      cities: cities.default.cities,
      companies: companies.default.companies,
      cargo: cargo.default.cargo,
      trucks: trucks.default.trucks,
      trailers: trailers.default.trailers,
    } as unknown as WikiData;
    loaded = new WikiIndex(data);
    return loaded;
  });
  return promise;
}

export function useWiki(): WikiIndex | null {
  const [w, setW] = useState<WikiIndex | null>(loaded);
  useEffect(() => {
    if (!w) void loadWiki().then(setW);
  }, [w]);
  return w;
}
