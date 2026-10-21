import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeCountries } from "../src/data/countries.mjs";
import { acceptLicence, cleanAuthor, groupByGeonames, isPublicDomain, looksLikeAPhoto, matchCity, toPhoto } from "../scripts/lib/commons.mjs";
import { loadCityFile } from "./helpers/cities.mjs";

const photoFile = country => JSON.parse(readFileSync(new URL(`../src/data/${country.photoFile}`, import.meta.url), "utf8"));

test("every active country has a photo file whose photos follow the rules", () => {
  let withPhoto = 0, cities = 0;
  for (const country of activeCountries()) {
    const file = photoFile(country);
    const ids = new Set(loadCityFile(country).cities.map(city => String(city.id)));
    assert.equal(file.metadata.countryCode, country.code);
    assert.equal(file.metadata.cities, ids.size);
    for (const [id, photo] of Object.entries(file.photos)) {
      assert.ok(ids.has(id), `${country.code}: photo for unknown city ${id}`);
      assert.ok(acceptLicence(photo.licence), `${id}: licence ${photo.licence}`);
      assert.ok(photo.author || isPublicDomain(photo.licence), `${id}: no author`);
      assert.match(photo.src, /^https:\/\/(upload|thumb)\.wikimedia\.org\//, id);
      assert.match(photo.page, /^https:\/\/commons\.wikimedia\.org\//, id);
      assert.ok(["P18", "P948", "wikipedia", "curated"].includes(photo.from), id);
      assert.ok(looksLikeAPhoto(photo.file), `${id}: ${photo.file}`);
      assert.match(photo.verified, /^\d{4}-\d{2}-\d{2}$/);
      // wikidata is null only for a hand-picked photo of a city whose Wikidata item is ambiguous
      if (photo.wikidata === null) assert.equal(photo.from, "curated", id);
      else assert.match(photo.wikidata, /^Q\d+$/);
      assert.ok(!(id in file.skipped), `${id} is both used and skipped`);
    }
    for (const id of Object.keys(file.skipped)) assert.ok(ids.has(id), `${country.code}: skipped unknown city ${id}`);
    assert.equal(Object.keys(file.photos).length + Object.keys(file.skipped).length, ids.size, `${country.code}: every city is either used or skipped`);
    assert.equal(Object.keys(file.photos).length, ids.size, `${country.code}: every city in the catalog has a photo (the others are in exclusions.json)`);
    withPhoto += Object.keys(file.photos).length;
    cities += ids.size;
  }
  assert.equal(withPhoto, cities);
});

test("excluded cities stay out of the catalog and say why", () => {
  const exclusions = JSON.parse(readFileSync(new URL("../src/data/places/exclusions.json", import.meta.url), "utf8")).cities;
  const inCatalog = new Set(activeCountries().flatMap(country => loadCityFile(country).cities.map(city => String(city.id))));
  assert.ok(Object.keys(exclusions).length > 0);
  for (const [id, entry] of Object.entries(exclusions)) {
    assert.ok(!inCatalog.has(id), `${entry.name} is excluded but still in the catalog`);
    assert.ok(entry.name && entry.countryCode && entry.reason.startsWith("no usable free photo"), id);
  }
  for (const country of activeCountries()) assert.ok(inCatalog.has(String(country.capitalGeonamesId)), `${country.code} capital kept`);
});

test("licences: free with credit only", () => {
  for (const ok of ["CC BY-SA 4.0", "CC BY 2.0", "CC0", "Public domain", "PD-self", "Attribution", "FAL", "Free Art License 1.3", "CC BY-SA 3.0 ro"]) assert.ok(acceptLicence(ok), ok);
  for (const bad of ["CC BY-NC 4.0", "CC BY-ND 2.0", "GPL", "GFDL", "", "All rights reserved"]) assert.ok(!acceptLicence(bad), bad);
});

test("author text from Commons HTML", () => {
  assert.equal(cleanAuthor('<a href="//commons.wikimedia.org/wiki/User:Foo">Foo</a> (<span>talk</span>)'), "Foo");
  assert.equal(cleanAuthor("Original uploader was Bar at ro.wikipedia"), "Bar");
  assert.equal(cleanAuthor("Ion &amp; Maria"), "Ion & Maria");
  assert.ok(cleanAuthor("x".repeat(200)).length <= 90);
});

test("maps, flags, coats of arms and collages are not city photos", () => {
  for (const name of ["Romania location map.svg", "Flag of Cluj.png", "Coat of arms of Sofia.jpg", "Stema Iasi.png", "Szeged címer.jpg", "Bucuresti colaj.jpg", "Budapest collage 2020.jpg"]) assert.ok(!looksLikeAPhoto(name), name);
  for (const name of ["Bucharest-Skyline-01.jpg", "Szegedi Dóm 5.JPG", "Panoramic view over central Sofia.jpg"]) assert.ok(looksLikeAPhoto(name), name);
});

test("one Wikidata item per city: a clearly dominant item wins, otherwise skip", () => {
  const rows = [
    { item: "http://www.wikidata.org/entity/Q1", geo: "100", img: "http://commons.wikimedia.org/wiki/Special:FilePath/A.jpg", rank: "http://wikiba.se/ontology#NormalRank", links: "60" },
    { item: "http://www.wikidata.org/entity/Q1", geo: "100", img: "http://commons.wikimedia.org/wiki/Special:FilePath/B.jpg", rank: "http://wikiba.se/ontology#PreferredRank", links: "60" },
    { item: "http://www.wikidata.org/entity/Q2", geo: "100", links: "5" },
    { item: "http://www.wikidata.org/entity/Q3", geo: "200", links: "4" },
    { item: "http://www.wikidata.org/entity/Q4", geo: "200", links: "3" },
    { item: "http://www.wikidata.org/entity/Q5", geo: "300", banner: "http://commons.wikimedia.org/wiki/Special:FilePath/Banner%20x.jpg", links: "9" },
  ];
  const byGeo = groupByGeonames(rows);
  const dominant = matchCity("100", byGeo);
  assert.equal(dominant.qid, "Q1");
  assert.deepEqual(dominant.candidates.map(c => c.file), ["B.jpg", "A.jpg"], "preferred rank first");
  assert.match(matchCity("200", byGeo).skip, /ambiguous/);
  assert.deepEqual(matchCity("300", byGeo).candidates, [{ file: "Banner x.jpg", from: "P948" }]);
  assert.equal(matchCity("999", byGeo).skip, "no Wikidata item");
});

test("a Commons file becomes a photo only when every rule passes", () => {
  const info = { mime: "image/jpeg", width: 2400, height: 1600, thumburl: "https://thumb.wikimedia.org/x/1280px-A.jpg?utm=1", thumbwidth: 1280, thumbheight: 853, descriptionurl: "https://commons.wikimedia.org/wiki/File:A.jpg", extmetadata: { Artist: { value: "Ana" }, LicenseShortName: { value: "CC BY-SA 4.0" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" } } };
  const ok = toPhoto(info, { file: "A.jpg", from: "P18", verified: "2026-10-20" });
  assert.equal(ok.photo.src, "https://thumb.wikimedia.org/x/1280px-A.jpg", "tracking parameters dropped");
  assert.equal(ok.photo.author, "Ana");
  assert.match(toPhoto({ ...info, width: 499 }, { file: "A.jpg" }).reject, /small/);
  assert.ok(toPhoto({ ...info, width: 500 }, { file: "A.jpg", from: "P18", verified: "x" }).photo, "500 px is enough");
  assert.match(toPhoto({ ...info, mime: "image/svg+xml" }, { file: "A.svg" }).reject, /type/);
  assert.match(toPhoto({ ...info, extmetadata: { ...info.extmetadata, LicenseShortName: { value: "CC BY-NC 2.0" } } }, { file: "A.jpg" }).reject, /licence/);
  assert.match(toPhoto({ ...info, extmetadata: { ...info.extmetadata, Artist: { value: "" } } }, { file: "A.jpg" }).reject, /author/);
  assert.match(toPhoto(info, { file: "Map of A.jpg" }).reject, /not a photo/);
  assert.match(toPhoto({ ...info, thumburl: "https://example.org/a.jpg" }, { file: "A.jpg" }).reject, /url/);
});
