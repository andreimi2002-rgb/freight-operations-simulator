import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTopLevel, parseTemplate, findTemplates, strip, linkTargets, getSection,
  currentTab, listItems, parseTables, slug, nameKey, roadName,
} from '../scripts/ats/lib/wikitext.mjs';

test('splitTopLevel ignores separators inside templates, links and galleries', () => {
  assert.deepEqual(splitTopLevel('a|{{b|c}}|[[d|e]]|f', '|'), ['a', '{{b|c}}', '[[d|e]]', 'f']);
  assert.deepEqual(splitTopLevel('x|<gallery>\nA.png|Cap\n</gallery>|y', '|'), ['x', '<gallery>\nA.png|Cap\n</gallery>', 'y']);
});

test('parseTemplate reads named and positional parameters', () => {
  const t = parseTemplate('{{Infobox_location\n|title = [[Sacramento]]\n|state = {{ATSData|CA city}}\n|x}}');
  assert.equal(t.name, 'Infobox location');
  assert.equal(t.params.title, '[[Sacramento]]');
  assert.equal(t.params.state, '{{ATSData|CA city}}');
  assert.equal(t.params[1], 'x');
});

test('findTemplates finds nested templates by name', () => {
  const found = findTemplates('{{A|{{Garage|ATS}} {{Gas|ATS}}}}', /^(Garage|Gas)$/);
  assert.deepEqual(found.map((f) => f.name), ['Garage', 'Gas']);
});

test('strip renders links, wiki templates and removes markup', () => {
  assert.equal(strip("'''[[Apade|Apade Auto Parts]]''' warehouse"), 'Apade Auto Parts warehouse');
  assert.equal(strip('{{ATS|Truck Dealers|truck dealer}}'), 'truck dealer');
  assert.equal(strip('{{Update|ATS|1.44}}'), '1.44');
  assert.equal(strip('The {{RSIGN|US|IS|5}} and {{RSIGN|US|US|50}} and {{RSIGN|US|CA|37}}'), 'The I-5 and US 50 and CA 37');
  assert.equal(strip('A<!-- hidden -->B<ref>note</ref>'), 'AB');
  assert.equal(strip('[[File:X.png|50px]]Text'), 'Text');
});

test('roadName follows the wiki RSIGN kinds', () => {
  assert.equal(roadName('IS', '80'), 'I-80');
  assert.equal(roadName('USCA', '101'), 'US 101');
  assert.equal(roadName('NV', '318'), 'NV 318');
});

test('linkTargets follows {{ATS|X}} to "X/American Truck Simulator"', () => {
  assert.deepEqual(
    linkTargets("* '''[[Apade]]''' warehouse\n* '''{{ATS|AI Automotive|AI Automotive}}''' warehouse\n[[File:A.png]] [[Category:X]]"),
    ['Apade', 'AI Automotive/American Truck Simulator'],
  );
});

test('getSection stops at the next heading of the same or higher level', () => {
  const text = '== A ==\none\n=== B ===\ntwo\n== C ==\nthree';
  assert.equal(getSection(text, 'A', 2).trim(), 'one\n=== B ===\ntwo');
  assert.equal(getSection(text, 'B').trim(), 'two');
  assert.equal(getSection(text, 'Missing'), null);
});

test('currentTab keeps the first tab of a tabber plus text around it', () => {
  const text = 'intro\n<tabber>\nAfter 1.44=\nnew\n|-|\nBefore 1.44=\nold\n</tabber>\noutro';
  const cur = currentTab(text);
  assert.equal(cur.name, 'After 1.44');
  assert.match(cur.content, /intro[\s\S]*new[\s\S]*outro/);
  assert.doesNotMatch(cur.content, /old/);
  assert.equal(currentTab('no tabs').name, null);
});

test('listItems returns bullet items', () => {
  assert.deepEqual(listItems('* a\n** b\ntext\n*\n* c'), ['a', 'b', 'c']);
});

test('parseTables reads headers, cells, colspan and rowspan', () => {
  const [t] = parseTables('{| class=wikitable\n! colspan=2 |Quarry\n!Other\n|-\n| rowspan=2 |{{CA}} [[California]]\n|\n* [[Mojave]]\n* [[Sacramento]]\n|}');
  assert.equal(t[0][0].colspan, 2);
  assert.equal(t[0][0].text, 'Quarry');
  assert.equal(t[1][0].rowspan, 2);
  assert.match(t[1][1].text, /\* \[\[Mojave\]\]\n\* \[\[Sacramento\]\]/);
});

test('slug and nameKey', () => {
  assert.equal(slug("Farmer's Barn"), 'farmers-barn');
  assert.equal(slug('Plaster & Sons'), 'plaster-and-sons');
  assert.equal(slug('Boom Lift (articulated)'), 'boom-lift-articulated');
  assert.equal(nameKey('Drop Deck'), nameKey('Dropdeck'));
});
