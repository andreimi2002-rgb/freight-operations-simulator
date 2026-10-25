// The game data and photos, imported once for the pages (bundled at build time).
import scopeFile from '../../data/ats/scope.json';
import citiesFile from '../../data/ats/cities.json';
import companiesFile from '../../data/ats/companies.json';
import cargoFile from '../../data/ats/cargo.json';
import trailersFile from '../../data/ats/trailers.json';
import distancesFile from '../../data/ats/distances.json';
import trucksFile from '../../data/ats/trucks.json';
import photosFile from '../../data/photos.json';
import categoriesFile from '../../data/categories.json';
import catalogPhotosFile from '../../data/catalog-photos.json';

export const scope = scopeFile;
export const cities = citiesFile.cities;
export const citiesMeta = citiesFile.meta;
export const companies = companiesFile.companies;
export const cargo = cargoFile.cargo;
export const trailers = trailersFile.trailers;
export const distances = distancesFile;
export const trucks = trucksFile.trucks;
export const photos = photosFile.photos;
// Our trailer categories (for the icons) and the illustrative photos of trucks, trailers and cargo.
export const categories = categoriesFile.categories;
export const catalogPhotos = catalogPhotosFile;

export const cityById = new Map(cities.map((c) => [c.id, c]));
export const stateByCode = new Map(scope.states.map((s) => [s.code, s]));
