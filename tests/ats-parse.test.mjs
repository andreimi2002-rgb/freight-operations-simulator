// Fragments below follow the layout of real Truck Simulator Wiki pages
// (trucksimulator.wiki.gg, CC BY-SA 4.0), shortened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCityPage, parseCompanyPage, parseCargoList, parseTrailerPage, introducedWith,
  parseWeight, parseValue, parseUn, skillFlags, cityDlc, stateCode, pageName, matchDepotType,
} from '../scripts/ats/lib/parse-ats.mjs';

const CITY = `{{Infobox_location
|title = [[Sacramento]]
|image = <gallery>
A.png|Skyline
</gallery>
|state = {{ATSData|CA city}}
|dlc = {{ATSData|BaseGame}}
|companies = 11
|truckdealer = {{Mack}}
|features = {{Dealer|Mack|ATS}} {{Garage|ATS}} {{Weigh|ATS}}
|connections = * '''[[Interstate 5|I-5]]'''
* '''[[US 50]]'''
|timezone = PDT
}}
'''Sacramento''' is a city.

== Features ==
<tabber>
After 1.44=
=== Depots ===
{{cols|2|
* '''[[Apade]]''' warehouse
* '''{{ATS|AI Automotive|AI Automotive}}''' warehouse
}}
In addition, there is a '''[[Bitumen]]''' roadworks.

=== Facilities ===
* {{ATS|Garages|Garage}}
* '''[[Driverse]]''' {{ATS|Truck Stops|truck stop}} with a weigh station

=== Landmarks ===
* Tower Bridge
|-|
Before 1.44=
=== Depots ===
* '''[[Wallbert]]''' food market
</tabber>

== Connections ==
<tabber>
After 1.50=
* The {{RSIGN|US|IS|5}} runs south to [[Stockton]] and north to [[Redding]] and [[Oregon]].
|-|
Before 1.41=
* old road to [[San Rafael (city)|San Rafael]]
</tabber>
`;

test('parseCityPage reads the infobox and only the current tabs', () => {
  const c = parseCityPage('Sacramento', CITY);
  assert.equal(c.name, 'Sacramento');
  assert.equal(c.state, 'CA');
  assert.equal(c.dlc, 'base');
  assert.equal(c.companyCount, 11);
  assert.equal(c.timezoneGame, 'PDT');
  assert.deepEqual(c.facilities, ['dealer', 'garage', 'weigh']);
  assert.deepEqual(c.truckDealers, ['Mack']);
  assert.deepEqual(c.roads, ['I-5', 'US 50']);
  assert.deepEqual(c.depotLinks, ['Apade', 'Bitumen', 'AI Automotive/American Truck Simulator']);
  assert.ok(!c.depotLinks.includes('Wallbert'), 'Before-tab depots are ignored');
  assert.deepEqual(c.landmarks, ['Tower Bridge']);
  assert.deepEqual(c.facilityDetails, ['Garage', 'Driverse truck stop with a weigh station']);
  assert.deepEqual(c.connectionLinks, ['Stockton', 'Redding', 'Oregon']);
  assert.equal(c.featuresTab, 'After 1.44');
  assert.deepEqual(c.notes, []);
});

test('city helpers', () => {
  assert.equal(stateCode('{{ATSData|NV city}}'), 'NV');
  assert.equal(stateCode('[[Nevada]]'), null);
  assert.deepEqual(cityDlc('{{ATSData|BaseGame}} ({{Update|ATS|1.53}})'), { dlc: 'base', addedInUpdate: '1.53' });
});

const COMPANY_SIMPLE = `{{Infobox_Company
|title = [[Apade|Apade Auto Parts Depot]]
|category = {{ATSData|vehicle}}
|industry = Vehicle parts distribution
|def = apa_car_whs
}}
== Operations ==
<tabber>
Locations=
{| class=wikitable
!State
!Warehouse<!-- apa_car_whs -->
|-
|{{AZ}} [[Arizona]]
|
* [[Yuma]]
|-
|{{CA}} [[California]]
|
* [[Fresno]]
* [[Sacramento]]
|}
|-|
Cargo types=
{| class=wikitable
!Accepted
!Provided
|-
|
* Batteries
* Tires
'''With {{ATS|Bobcat Cargo Pack}} DLC:'''
* Forklift Bobcat D30
|
* Tires
|}
</tabber>
`;

test('parseCompanyPage: one depot type, cargo with a DLC section', () => {
  const c = parseCompanyPage('Apade', COMPANY_SIMPLE);
  assert.equal(c.name, 'Apade');
  assert.equal(c.fullName, 'Apade Auto Parts Depot');
  assert.equal(c.category, 'vehicle');
  assert.deepEqual(c.defIds, ['apa_car_whs']);
  assert.equal(c.depotTypes.length, 1);
  const d = c.depotTypes[0];
  assert.equal(d.type, 'Warehouse');
  assert.deepEqual(d.gameIds, ['apa_car_whs']);
  assert.deepEqual(d.citiesByState, { Arizona: ['Yuma'], California: ['Fresno', 'Sacramento'] });
  assert.deepEqual(d.cargo.accepts.base, ['Batteries', 'Tires']);
  assert.deepEqual(d.cargo.accepts.dlc, { 'Bobcat Cargo Pack': ['Forklift Bobcat D30'] });
  assert.deepEqual(d.cargo.provides.base, ['Tires']);
});

const COMPANY_GROUPS = `{{Infobox_Company
|title = [[Vitas Power]]
|category = {{ATSData|construction}}
}}
== Operations ==
<tabber>
Locations=
{| class=wikitable
!State
!Wind turbine<br>construction site<!-- vp_epw_sit -->
!Plant<!-- vp_epw_pln -->
|-
|{{CA}} [[California]]
|
* [[Mojave]]
|
|}
|-|
Cargo types=
{| class=wikitable
! colspan=2 |Construction site
! colspan=2 |Plant
|-
|''Accepted''
|''Provided''
|''Accepted''
|''Provided''
|-
|
* Scaffolding
|
* Construction Houses
|
* Cables
|
* Utility Poles
|}
</tabber>
`;

test('parseCompanyPage: several depot types, cargo groups matched by name', () => {
  const c = parseCompanyPage('Vitas Power/American Truck Simulator', COMPANY_GROUPS);
  assert.equal(c.name, 'Vitas Power');
  const [site, plant] = c.depotTypes;
  assert.equal(site.type, 'Wind turbine construction site');
  assert.deepEqual(site.gameIds, ['vp_epw_sit']);
  assert.deepEqual(site.citiesByState, { California: ['Mojave'] });
  assert.deepEqual(site.cargo.accepts.base, ['Scaffolding']);
  assert.deepEqual(plant.cargo.provides.base, ['Utility Poles']);
});

const COMPANY_GAS = `{{Infobox_Company
|title = [[Driverse]]
|category = {{ATSData|energy}}
}}
== Operations ==
<tabber>
Locations=
{| class=wikitable
!State
!City<!-- dri_oil_gst -->
!Location
|-
| rowspan=2 |{{CA}} [[California]]
|[[Sacramento]]
|At {{RSIGN|US|IS|80}} exit 85
|-
|[[Fresno]]
|South side
|-
|{{NV}} [[Nevada]]
|[[Reno]]
|
|}
|-|
Cargo types=
{| class=wikitable
!Accepted
|-
|
* Diesel
* Gasoline
|}
</tabber>
`;

test('parseCompanyPage: gas station layout with rowspan and a Location column', () => {
  const c = parseCompanyPage('Driverse', COMPANY_GAS);
  assert.equal(c.depotTypes.length, 1);
  const d = c.depotTypes[0];
  assert.equal(d.type, null);
  assert.deepEqual(d.gameIds, ['dri_oil_gst']);
  assert.deepEqual(d.citiesByState, { California: ['Sacramento', 'Fresno'], Nevada: ['Reno'] });
  assert.equal(d.locations.Sacramento, 'At I-80 exit 85');
  assert.deepEqual(d.cargo.accepts.base, ['Diesel', 'Gasoline']);
  assert.deepEqual(d.cargo.provides.base, []);
});

test('parseCompanyPage skips companies marked removed and historical tables', () => {
  const removed = parseCompanyPage('Old Co', `{{Removed|ATS}}\n${COMPANY_SIMPLE}`);
  assert.equal(removed.removed, true);
  const historical = parseCompanyPage('Mud', COMPANY_SIMPLE.replace('Locations=\n', 'Locations=\nThere are currently no Mud depots remaining in the game.\n'));
  assert.deepEqual(historical.depotTypes, []);
  assert.match(historical.notes[0], /historical/);
});

test('pageName and matchDepotType', () => {
  assert.equal(pageName('Phoenix (company)'), 'Phoenix');
  assert.equal(pageName('AI Automotive/American Truck Simulator'), 'AI Automotive');
  const types = [{ type: 'Gas station' }, { type: 'Fuel storage' }, { type: 'Storage' }];
  assert.equal(matchDepotType(types, 'Gas stations').type, 'Gas station');
  assert.equal(matchDepotType(types, 'Storage').type, 'Storage');
  assert.equal(matchDepotType(types, 'Unknown'), null);
});

const CARGO_LIST = `== Summary ==
As of {{Update|ATS|1.61}}, there are 3 different base cargoes in the game, with an additional 1 cargoes in the {{ATS|Heavy Cargo Pack}} DLC, 1 cargoes in the [[KRONE Agriculture Equipment]] DLC, resulting in a total of 5 cargoes.

=== List of Cargo ===
{| class="wikitable sortable"
|-
! scope="col" |Cargo
! scope="col" |DLC/Patch
! scope="col" |Weight (lb)
! scope="col" |Value
! scope="col" |UN/NA Number
! scope="col" |Dynamic Loading
! scope="col" |Skills
! scope="col" |Trailer types
! scope="col" |Icon
|-
|Milk
|Launch<br>(updated in {{Update|ATS|1.37|1.37}})
|22,248–61,729
|0.77<br>0.864<ref name="tank">unit_reward_per_km value for Tank Trailers</ref>
|–
|No
|
|
* Food Tank
* Refrigerated
|[[File:Milk.png]]
|-
|Ethane
|{{Update|ATS|1.47|1.47}}
|35,979
|1.23
|2059<nowiki>**</nowiki><br><small>1035</small>
|No
|[[File:Adr_21.png|link=Hazardous Materials|center|HazMat Class 2.1]]
|
* Gas Tank
|[[File:Ethane.png]]
|-
|Barley
|[[Louisiana]]
|???
|0.692
|–
|Yes
|
|
* Hopper
|[[File:Barley.png]]
|-
|Transformer
|{{ATS|Heavy Cargo Pack}}
|123,500
|27
|–
|No
|[[File:Heavy ico.png|link=|center]]
|
* Lowboy Triple
|[[File:T.png]]
|-
|Mower
|[[KRONE Agriculture Equipment]]
|9,000
|0.18–0.225
|–
|No
|[[File:Highvalue ico.png|link=High-Value Cargo|center]] [[File:Fragile_ico.png|link=Fragile Cargo|center]]
|
* Drop Deck
|[[File:M.png]]
|}
`;

test('parseCargoList reads every column and the summary counts', () => {
  const { rows, summary } = parseCargoList(CARGO_LIST);
  assert.equal(rows.length, 5);
  assert.deepEqual(summary, { asOfUpdate: '1.61', base: 3, total: 5, dlc: { 'Heavy Cargo Pack': 1, 'KRONE Agriculture Equipment': 1 } });
  const [milk, ethane, barley, transformer, mower] = rows;
  assert.deepEqual(milk.introducedWith, { kind: 'launch', name: null });
  assert.deepEqual(milk.weightLb, { min: 22248, max: 61729 });
  assert.equal(milk.valuePerKm, 0.77);
  assert.deepEqual(milk.valuePerKmAlt, [{ value: 0.864, note: 'unit_reward_per_km value for Tank Trailers' }]);
  assert.deepEqual(milk.trailerTypes, ['Food Tank', 'Refrigerated']);
  assert.equal(milk.un, null);
  assert.deepEqual(ethane.introducedWith, { kind: 'update', name: '1.47' });
  assert.equal(ethane.un, '2059');
  assert.equal(ethane.unExpected, '1035');
  assert.equal(ethane.unFlagged, true);
  assert.deepEqual(ethane.flags, ['adr']);
  assert.deepEqual(ethane.hazmatClasses, ['2.1']);
  assert.deepEqual(barley.introducedWith, { kind: 'map', name: 'Louisiana' });
  assert.equal(barley.weightLb, null);
  assert.equal(barley.dynamicLoading, true);
  assert.deepEqual(transformer.introducedWith, { kind: 'dlc', name: 'Heavy Cargo Pack' });
  assert.deepEqual(transformer.flags, ['heavy']);
  assert.deepEqual(mower.introducedWith, { kind: 'dlc', name: 'KRONE Agriculture Equipment' });
  assert.equal(mower.valuePerKm, null);
  assert.deepEqual(mower.valuePerKmRange, { min: 0.18, max: 0.225 });
  assert.deepEqual(mower.flags, ['fragile', 'high-value']);
});

test('cargo cell helpers', () => {
  assert.deepEqual(parseWeight('66,138'), { min: 66138, max: 66138 });
  assert.equal(parseWeight('???'), null);
  assert.deepEqual(parseValue('2.21'), { value: 2.21, range: null, alt: [] });
  assert.deepEqual(parseUn('1'), { un: null, unExpected: null, flagged: false, raw: '1' });
  assert.deepEqual(parseUn('1203'), { un: '1203', unExpected: null, flagged: false, raw: null });
  assert.deepEqual(introducedWith('{{ATS|Special Transport}}'), { kind: 'dlc', name: 'Special Transport' });
  assert.deepEqual(introducedWith(''), { kind: 'unknown', name: null });
  assert.deepEqual(skillFlags('[[File:Mystery.png]]').unknown, ['Mystery.png']);
});

test('parseTrailerPage reads price, ownership and cargo icons', () => {
  const t = parseTrailerPage('Dry Van Trailer', `{{Infobox_Trailer
|title=[[Dry Van Trailer|Dry Van]]
|price=$41,380
|own={{YN|Y}}
|articulated=No
|ct= General, dry goods
|cargo=[[File:ATS Cargo icon Beverages.png|50px|Beverages]][[File:ATS Cargo icon Cans.png|50px|Cans]]
}}`);
  assert.equal(t.name, 'Dry Van');
  assert.equal(t.priceUsd, 41380);
  assert.deepEqual(t.pricesUsd, [41380]);
  const two = parseTrailerPage('Flatbed Trailer', '{{Infobox_Trailer\n|title=Flatbed\n|price=$30,700 / $61,360\n}}');
  assert.equal(two.priceUsd, null);
  assert.deepEqual(two.pricesUsd, [30700, 61360]);
  assert.equal(t.ownable, true);
  assert.equal(t.articulated, false);
  assert.equal(t.cargoTypesNote, 'General, dry goods');
  assert.deepEqual(t.cargo, ['Beverages', 'Cans']);
});
