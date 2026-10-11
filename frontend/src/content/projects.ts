/** Taken from the project references published on moonstarpower.com. Add photographs in /public/img/projects when available. */
export type PortfolioProject = { name: string; capacityKva: number; location: string; district: string; type: string; scope: string };

export const PROJECTS: PortfolioProject[] = [
  { name: "Bismillah Vila", capacityKva: 200, location: "Ekuria Graveyard Road, Shubadda, South Keranigonj, Dhaka-1311", district: "South Keranigonj", type: "Substation", scope: "200 kVA substation" },
  { name: "Navik Vila", capacityKva: 250, location: "Mirpur, Dhaka", district: "Mirpur", type: "Substation", scope: "250 kVA substation" },
  { name: "Venus Land Kornafuli Garden", capacityKva: 200, location: "Katherpul, Sutrapur, Dhaka", district: "Sutrapur", type: "Substation", scope: "200 kVA substation" },
  { name: "Zom Zom Tower", capacityKva: 500, location: "Modina Nogor, Saban Factory Road, South Keranigonj, Dhaka", district: "South Keranigonj", type: "Substation", scope: "500 kVA substation" },
  { name: "Telghat City Plaza", capacityKva: 630, location: "Kaligonj, Telghat, South Keranigonj, Dhaka", district: "South Keranigonj", type: "Substation", scope: "630 kVA substation" },
];
