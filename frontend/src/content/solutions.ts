export type Solution = {
  slug: string;
  title: string;
  short: string;
  image: string;
  imageAlt: string;
  intro: string;
  provide: string[];
  serves: string[];
  notes?: string;
  productCategory?: string;
};

/** Service scope is taken from moonstarpower.com. Items marked "scope confirmed per project" must be verified per enquiry. */
export const SOLUTIONS: Solution[] = [
  {
    slug: "substation",
    title: "Substation Solutions",
    short: "Turnkey electrical substations from consultation and design coordination to commissioning.",
    image: "/img/substation.webp",
    imageAlt: "Outdoor electrical substation structure at dusk",
    intro:
      "Moon Star is listed as an approved electrical substation manufacturer by the Ministry of Power, Energy & Mineral Resources (Serial No. 94). We plan and deliver substations sized to the actual connected load of your building or plant.",
    provide: ["Load assessment and substation capacity selection", "Transformer, HT and LT panel supply as one coordinated package", "Installation, testing and commissioning", "Maintenance and technical support after handover"],
    serves: ["Residential buildings and housing developments", "Commercial towers and plazas", "Industrial and factory loads"],
    productCategory: "transformer",
  },
  {
    slug: "transformers",
    title: "Transformers",
    short: "HT and LT distribution and industrial transformers: supply, installation, testing and maintenance.",
    image: "/img/transformer.webp",
    imageAlt: "Oil-filled distribution transformer",
    intro: "Distribution and industrial transformers supplied against a documented load calculation rather than a rule of thumb, so the rating suits both current demand and planned expansion.",
    provide: ["Distribution transformers (HT / LT)", "Industrial transformers", "Installation, testing and commissioning", "Periodic maintenance and troubleshooting"],
    serves: ["Substations for multi-storey buildings", "Industrial plants", "Utility-connected commercial sites"],
    productCategory: "transformer",
  },
  {
    slug: "panels",
    title: "HT/LT Panels & Switchgear",
    short: "HT and LT panels and substation panels, configured to the project single-line diagram.",
    image: "/img/panels.webp",
    imageAlt: "Row of low-voltage switchboard panels in an electrical room",
    intro: "HT and LT panels, including substation panels, configured for the protection, metering and distribution requirements of each project.",
    provide: ["HT panels (VCB / LBS configurations, where applicable)", "LT main distribution panels", "Substation panels", "Panel testing and site commissioning"],
    serves: ["Buildings and developments", "Factories", "Commercial complexes"],
    notes: "Illustrative image. Final configuration is project-specific.",
    productCategory: "lt_panel",
  },
  {
    slug: "pfi-panels",
    title: "PFI Panels",
    short: "Power Factor Improvement panels to help avoid power factor penalties and reduce reactive demand.",
    image: "/img/pfi.webp",
    imageAlt: "Automatic power factor improvement capacitor panel",
    intro: "Automatic power factor correction sized from the measured or calculated reactive load, helping reduce utility power factor penalties.",
    provide: ["Automatic PFI capacitor panels", "Sizing from load and target power factor", "Installation and commissioning", "Maintenance and capacitor replacement"],
    serves: ["Industrial plants with motor loads", "Commercial buildings", "Substations needing improved power factor"],
    notes: "Illustrative image.",
    productCategory: "pfi_panel",
  },
  {
    slug: "generators",
    title: "Diesel Generators",
    short: "Industrial diesel generator sets with ATS integration, troubleshooting and 24/7 maintenance support.",
    image: "/img/generator.webp",
    imageAlt: "Diesel generator on a construction site",
    intro: "Backup and prime power solutions including automatic transfer switch (ATS) panel integration.",
    provide: ["Diesel generator supply", "ATS panel integration", "Troubleshooting and repairs", "Maintenance support"],
    serves: ["Buildings requiring backup power", "Industrial sites", "Construction and temporary power needs"],
    productCategory: "generator",
  },
  {
    slug: "solar",
    title: "Solar Power Systems",
    short: "Customised on-grid and off-grid solar for residential, commercial and industrial sites.",
    image: "/img/solar.webp",
    imageAlt: "Solar panels under a clear sky",
    intro: "On-grid and off-grid solar systems designed for the roof area and consumption of the site, with installation, monitoring and inverter repair services.",
    provide: ["On-grid and off-grid systems", "Roof solutions and installation", "Monitoring and consultation", "Inverter repair"],
    serves: ["Homes", "Commercial buildings", "Industrial roofs"],
    productCategory: "solar",
  },
  {
    slug: "lifts",
    title: "Lift & Elevator Solutions",
    short: "Lift and elevator supply and installation as part of Moon Star's complete building power offering.",
    image: "/img/lift.webp",
    imageAlt: "Technician inspecting a passenger elevator control panel",
    intro: "Lift solutions are part of Moon Star's stated scope. Contact the team to discuss capacity, stops and specifications for your building.",
    provide: ["Lift supply and installation (scope confirmed per project)", "Coordination with building power supply", "Maintenance support"],
    serves: ["Residential buildings", "Commercial buildings"],
    notes: "Illustrative image.",
    productCategory: "lift",
  },
  {
    slug: "maintenance",
    title: "Maintenance & Technical Services",
    short: "Testing, commissioning, monitoring and 24/7 maintenance support for installed power equipment.",
    image: "/img/maintenance.webp",
    imageAlt: "Engineers testing an outdoor transformer",
    intro: "Installation, testing, commissioning and ongoing maintenance, backed by a 24/7 support line.",
    provide: ["Testing and commissioning", "Preventive maintenance", "Troubleshooting and repairs", "24/7 support line"],
    serves: ["Existing installations (subject to inspection)", "New installations delivered by Moon Star"],
    notes: "Illustrative image.",
  },
];

export const PROCESS = [
  { n: "01", title: "Consultation", text: "We listen to the needs of the project and visit the site where needed." },
  { n: "02", title: "Load Assessment", text: "Connected load, demand and power factor are assessed against documented engineering assumptions." },
  { n: "03", title: "Technical Proposal", text: "An itemised proposal with equipment ratings, reviewed by an engineer." },
  { n: "04", title: "Equipment Supply", text: "Equipment is supplied against the approved proposal." },
  { n: "05", title: "Installation & Commissioning", text: "Installation, testing and commissioning on site." },
  { n: "06", title: "Maintenance", text: "Ongoing maintenance and a 24/7 support line." },
];
