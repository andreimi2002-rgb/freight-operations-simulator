// The game data and photos, imported once for the pages (bundled at build time).
import scopeFile from '../../data/ats/scope.json';
import citiesFile from '../../data/ats/cities.json';
import companiesFile from '../../data/ats/companies.json';
import cargoFile from '../../data/ats/cargo.json';
import trailersFile from '../../data/ats/trailers.json';
import distancesFile from '../../data/ats/distances.json';
import photosFile from '../../data/photos.json';

export const scope = scopeFile;
export const cities = citiesFile.cities;
export const citiesMeta = citiesFile.meta;
export const companies = companiesFile.companies;
export const cargo = cargoFile.cargo;
export const trailers = trailersFile.trailers;
export const distances = distancesFile;
export const photos = photosFile.photos;

export const cityById = new Map(cities.map((c) => [c.id, c]));
export const stateByCode = new Map(scope.states.map((s) => [s.code, s]));
