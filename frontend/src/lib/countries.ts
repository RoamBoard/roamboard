export type Country = {
  code: string;
  name: string;
};

const countryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countries: Country[] = countryCodes
  .map((code) => ({ code, name: displayNames.of(code) ?? code }))
  .sort((left, right) => left.name.localeCompare(right.name));

const aliases = new Map<string, string>([
  ["america", "US"],
  ["britain", "GB"],
  ["england", "GB"],
  ["great britain", "GB"],
  ["uk", "GB"],
  ["united states of america", "US"],
  ["usa", "US"],
]);

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  return [...left].reduce((row, leftCharacter, leftIndex) => {
    const next = [leftIndex + 1];
    [...right].forEach((rightCharacter, rightIndex) => {
      next.push(Math.min(
        (next[rightIndex] ?? 0) + 1,
        (row[rightIndex + 1] ?? 0) + 1,
        (row[rightIndex] ?? 0) + (leftCharacter === rightCharacter ? 0 : 1),
      ));
    });
    return next;
  }, previous)[right.length] ?? right.length;
}

export function findCountry(value: string): Country | undefined {
  const query = normalize(value);
  const aliasCode = aliases.get(query);
  return countries.find((country) => (
    normalize(country.name) === query
    || country.code.toLowerCase() === query
    || country.code === aliasCode
  ));
}

export function suggestCountries(value: string, limit = 6): Country[] {
  const query = normalize(value);
  if (!query) return [];

  return countries
    .map((country) => {
      const name = normalize(country.name);
      const aliasMatches = [...aliases].some(([alias, code]) => code === country.code && alias.startsWith(query));
      const distance = editDistance(query, name);
      const score = name === query || country.code.toLowerCase() === query
        ? 0
        : name.startsWith(query) || aliasMatches
          ? 1
          : name.includes(query)
            ? 2
            : 3 + distance;
      return { country, distance, score };
    })
    .filter(({ country, distance, score }) => (
      score <= 2 || distance <= Math.max(2, Math.floor(normalize(country.name).length * 0.3))
    ))
    .sort((left, right) => left.score - right.score || left.distance - right.distance || left.country.name.localeCompare(right.country.name))
    .slice(0, limit)
    .map(({ country }) => country);
}
