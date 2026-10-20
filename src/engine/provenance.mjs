// Provenance for every fact in a Load (see AGENTS.md). Language-neutral: formulas, bases,
// notes and reasons are ids that the view model translates; sources carry name/url/date.
//   sourced   { value, source: { name, url, retrievedAt, license?, note? } }
//   computed  { value, formula, inputs: { key: number|string|object }, dependsOnEstimate? }
//   estimated { value, basis, range? }
//   simulated { value, note }
//   unavailable { value: null, phase, reason }   (not a provenance level: no value yet)

export const LEVELS = ["sourced", "computed", "estimated", "simulated"];
export const UNAVAILABLE = "unavailable";
export const PHASES = ["1B", "2", "3", "4", "5", "6", "7"];

export const sourced = (value, source) => ({ value, level: "sourced", source });
export const computed = (value, formula, inputs, extra = {}) => ({ value, level: "computed", formula, inputs, ...extra });
export const estimated = (value, basis, extra = {}) => ({ value, level: "estimated", basis, ...extra });
export const simulated = (value, note) => ({ value, level: "simulated", note });
export const unavailable = (phase, reason) => ({ value: null, level: UNAVAILABLE, phase, reason });

export const isFact = item => Boolean(item) && typeof item === "object" && !Array.isArray(item) && typeof item.level === "string" && "value" in item;

export function validateFact(fact) {
  const problems = [];
  if (!isFact(fact) || ![...LEVELS, UNAVAILABLE].includes(fact.level)) return ["unknown provenance level"];
  if (fact.level === "sourced") {
    const s = fact.source || {};
    if (!s.name) problems.push("sourced fact without source name");
    if (!/^https?:\/\//.test(s.url || "")) problems.push("sourced fact without source URL");
    if (!s.retrievedAt) problems.push("sourced fact without retrieval date");
  }
  if (fact.level === "computed") {
    if (!fact.formula) problems.push("computed fact without formula");
    if (!fact.inputs || typeof fact.inputs !== "object" || !Object.keys(fact.inputs).length) problems.push("computed fact without inputs");
  }
  if (fact.level === "estimated" && !fact.basis) problems.push("estimated fact without basis");
  if (fact.level === "simulated" && !fact.note) problems.push("simulated fact without note");
  if (fact.level === UNAVAILABLE) {
    if (fact.value !== null) problems.push("unavailable fact with a value");
    if (!PHASES.includes(String(fact.phase))) problems.push("unavailable fact without a known phase");
    if (!fact.reason) problems.push("unavailable fact without a reason");
  } else if (fact.value === null || fact.value === undefined) {
    problems.push(`${fact.level} fact without a value`);
  }
  return problems;
}

// Every fact inside an object tree, with its path (facts are not searched inside other facts).
export function collectFacts(node, path = "") {
  if (isFact(node)) return [{ path, fact: node }];
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, child]) => collectFacts(child, path ? `${path}.${key}` : key));
}
