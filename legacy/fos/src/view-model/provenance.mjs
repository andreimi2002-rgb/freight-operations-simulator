// Labels for provenance levels; the levels themselves live in src/engine/provenance.mjs.
import { t } from "../i18n/i18n.mjs";

export { LEVELS, UNAVAILABLE, PHASES } from "../engine/provenance.mjs";
export const levelLabel = level => t(`prov.${level}`);
export const levelHelp = level => t(`prov.${level}.help`);
export const phaseText = phase => t("unavailable.phase", { phase });
