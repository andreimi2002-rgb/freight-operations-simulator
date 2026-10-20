// Regulation (EC) No 561/2006 — driving times, breaks and rest periods.
// Only the values used by the simplified minimum-transit calculation (phase 1B).
// Text checked on 2026-10-20 against the copy at legislation.gov.uk (EUR-Lex could not be
// fetched automatically); the official reference is the EUR-Lex ELI link below.
export const REG_561 = {
  maxDailyDrivingMin: 9 * 60,        // Art. 6(1): daily driving time shall not exceed nine hours
  extendedDailyDrivingMin: 10 * 60,  // Art. 6(1): at most 10 hours, not more than twice a week (not used: conservative)
  weeklyDrivingMaxMin: 56 * 60,      // Art. 6(2)
  fortnightDrivingMaxMin: 90 * 60,   // Art. 6(3)
  drivingBeforeBreakMin: 4 * 60 + 30, // Art. 7: after a driving period of four and a half hours ...
  breakMin: 45,                       // ... an uninterrupted break of not less than 45 minutes
  regularDailyRestMin: 11 * 60,       // Art. 4(g), 8(2): regular daily rest of at least 11 hours
  reducedDailyRestMin: 9 * 60,        // Art. 4(g), 8(4): reduced daily rest, at most three times (not used: conservative)
  source: {
    name: "Regulation (EC) No 561/2006, Art. 4(g), 6, 7, 8",
    url: "https://eur-lex.europa.eu/eli/reg/2006/561/oj",
    retrievedAt: "2026-10-20",
  },
};
