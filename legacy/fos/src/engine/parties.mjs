// Simulated shipper and consignee ROLES (never a real company or contract).
import { ROLES_BY_FAMILY, ROLE_OVERRIDES } from "../data/cargo/roles.mjs";
import { simulated } from "./provenance.mjs";

const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

export function partyFacts(cargo, random = Math.random) {
  const roles = ROLE_OVERRIDES[cargo.id] || ROLES_BY_FAMILY[cargo.family] || { shippers: ["manufacturer"], consignees: ["distributor"] };
  return {
    shipperRole: simulated(pick(roles.shippers, random), "shipperRole"),
    consigneeRole: simulated(pick(roles.consignees, random), "consigneeRole"),
  };
}
