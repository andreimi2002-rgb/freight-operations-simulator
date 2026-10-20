// Provenance levels for every displayed fact (see AGENTS.md).
// "unavailable" is not a level: it marks a row the engine cannot fill yet.
import { t } from "../i18n/i18n.mjs";

export const LEVELS = ["sourced", "computed", "estimated", "simulated"];
export const UNAVAILABLE = "unavailable";
export const PHASES = ["1B", "2", "3", "4", "5", "6", "7"];

export const sourcedFact = ({ name, url, retrievedAt, license = null }) => ({ level: "sourced", source: { name, url, retrievedAt, license } });
export const computedFact = ({ formula, inputs }) => ({ level: "computed", formula, inputs });
export const estimatedFact = ({ basis }) => ({ level: "estimated", basis });
export const simulatedFact = ({ note }) => ({ level: "simulated", note });
export const unavailableFact = (phase, reason) => ({ level: UNAVAILABLE, phase, reason });

// Returns a list of problems; an empty list means the fact is complete.
export function validateFact(fact) {
  const problems = [];
  if (!fact || ![...LEVELS, UNAVAILABLE].includes(fact.level)) return ["unknown provenance level"];
  if (fact.level === "sourced") {
    const s = fact.source || {};
    if (!s.name) problems.push("sourced fact without source name");
    if (!/^https?:\/\//.test(s.url || "")) problems.push("sourced fact without source URL");
    if (!s.retrievedAt) problems.push("sourced fact without retrieval date");
  }
  if (fact.level === "computed") {
    if (!fact.formula) problems.push("computed fact without formula");
    if (!Array.isArray(fact.inputs) || !fact.inputs.length) problems.push("computed fact without inputs");
  }
  if (fact.level === "estimated" && !fact.basis) problems.push("estimated fact without basis");
  if (fact.level === "simulated" && !fact.note) problems.push("simulated fact without note");
  if (fact.level === UNAVAILABLE) {
    if (!PHASES.includes(String(fact.phase))) problems.push("unavailable fact without a known phase");
    if (!fact.reason) problems.push("unavailable fact without a reason");
  }
  return problems;
}

export const levelLabel = level => t(`prov.${level}`);
export const levelHelp = level => t(`prov.${level}.help`);
export const phaseText = phase => t("unavailable.phase", { phase });
