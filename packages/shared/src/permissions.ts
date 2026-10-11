/** Permission catalogue and default role mapping. Roles/overrides are stored in the DB and editable by admins. */
export const PERMISSIONS = [
  ["quotation.view_all", "Quotations", "View every quotation"],
  ["quotation.view_own", "Quotations", "View quotations created by yourself"],
  ["quotation.create", "Quotations", "Create new quotations"],
  ["quotation.edit", "Quotations", "Edit draft quotations"],
  ["quotation.revise", "Quotations", "Create revisions of sent/approved quotations"],
  ["quotation.submit", "Quotations", "Submit quotations for approval"],
  ["quotation.approve_technical", "Quotations", "Approve, reject or return technical proposals"],
  ["quotation.approve_commercial", "Quotations", "Approve, reject or return commercial terms"],
  ["quotation.send", "Quotations", "Mark approved quotations as sent"],
  ["quotation.update_status", "Quotations", "Mark sent quotations accepted / rejected"],
  ["quotation.override_technical", "Quotations", "Override preliminary equipment recommendation (reason recorded)"],
  ["quotation.manual_price", "Quotations", "Manually adjust line-item prices"],
  ["quotation.discount", "Quotations", "Apply discounts within the configured limit"],
  ["quotation.discount_unlimited", "Quotations", "Apply discounts above the approval threshold"],
  ["quotation.view_cost", "Quotations", "See internal cost and margin on quotations"],
  ["pdf.download", "Quotations", "Generate and download quotation PDFs"],
  ["workorder.manage", "Work orders", "Record and edit work orders"],
  ["project.view", "Projects", "View areas, housings and projects"],
  ["project.create", "Projects", "Create projects, housings and areas"],
  ["project.edit", "Projects", "Edit existing project records"],
  ["product.view", "Catalogue", "View the product catalogue and selling prices"],
  ["product.manage", "Catalogue", "Create and edit products and categories"],
  ["price.manage", "Catalogue", "Change product prices"],
  ["price.view_cost", "Catalogue", "See internal cost prices"],
  ["price.audit", "Catalogue", "View price audit history"],
  ["report.view", "Reports", "View reports"],
  ["report.export", "Reports", "Export reports as CSV"],
  ["user.manage", "Administration", "Create users and assign roles"],
  ["role.manage", "Administration", "Edit role permissions and per-user overrides"],
  ["settings.manage", "Administration", "Edit company, workflow, pricing and engineering settings"],
  ["template.manage", "Administration", "Edit the quotation template"],
  ["audit.view", "Administration", "View the audit log"],
  ["inquiry.view", "Administration", "View website enquiries"],
] as const;

export type PermKey = (typeof PERMISSIONS)[number][0];

const ALL = PERMISSIONS.map((p) => p[0]) as PermKey[];

export const ROLE_DEFS: { key: string; name: string; description: string; perms: PermKey[] }[] = [
  { key: "super_admin", name: "Super Admin", description: "Full system administration", perms: ALL },
  {
    key: "pricing_admin",
    name: "Pricing Admin",
    description: "Maintains product prices, pricing rules and the price audit trail",
    perms: [
      "product.view", "product.manage", "price.manage", "price.view_cost", "price.audit", "quotation.view_all",
      "quotation.view_cost", "report.view", "report.export", "project.view", "pdf.download",
    ],
  },
  {
    key: "employee",
    name: "Employee",
    description: "Creates and revises quotations and manages project records",
    perms: [
      "quotation.view_own", "quotation.create", "quotation.edit", "quotation.revise", "quotation.submit",
      "quotation.send", "quotation.update_status", "quotation.discount", "pdf.download", "workorder.manage",
      "project.view", "project.create", "project.edit", "product.view", "report.view",
    ],
  },
  {
    key: "technical_approver",
    name: "Technical Approver",
    description: "Reviews load calculations and equipment selection",
    perms: [
      "quotation.view_all", "quotation.approve_technical", "quotation.override_technical", "project.view",
      "product.view", "pdf.download", "report.view",
    ],
  },
  {
    key: "viewer",
    name: "Management / Viewer",
    description: "Read-only access to quotations, projects and reports",
    perms: ["quotation.view_all", "project.view", "product.view", "report.view", "report.export", "pdf.download"],
  },
];

export const PRODUCT_CATEGORIES: [string, string][] = [
  ["transformer", "Transformers"],
  ["ht_switchgear", "HT Switchgear (VCB / LBS / RMU)"],
  ["lt_panel", "LT Panels"],
  ["pfi_panel", "PFI Panels"],
  ["cable", "Cables & Accessories"],
  ["generator", "Diesel Generators"],
  ["solar", "Solar Systems"],
  ["lift", "Lifts & Elevators"],
  ["installation", "Installation Materials"],
  ["labour", "Labour & Installation"],
  ["transport", "Transport & Delivery"],
  ["testing", "Testing & Commissioning"],
  ["other", "Other"],
];

export type WorkflowConfig = {
  transitions: Record<string, { to: string; perm: PermKey | null; label: string }[]>;
  lockOn: string[];
  discountApprovalPct: number;
  minMarginPct: number;
};

export const DEFAULT_WORKFLOW: WorkflowConfig = {
  transitions: {
    draft: [{ to: "pending_technical", perm: "quotation.submit", label: "Submit for technical approval" }],
    pending_technical: [
      { to: "pending_commercial", perm: "quotation.approve_technical", label: "Approve technically" },
      { to: "draft", perm: "quotation.approve_technical", label: "Return for correction" },
      { to: "rejected", perm: "quotation.approve_technical", label: "Reject" },
    ],
    pending_commercial: [
      { to: "approved", perm: "quotation.approve_commercial", label: "Approve commercially" },
      { to: "draft", perm: "quotation.approve_commercial", label: "Return for correction" },
      { to: "rejected", perm: "quotation.approve_commercial", label: "Reject" },
    ],
    approved: [{ to: "sent", perm: "quotation.send", label: "Mark as sent to client" }],
    sent: [
      { to: "accepted", perm: "quotation.update_status", label: "Mark accepted" },
      { to: "rejected", perm: "quotation.update_status", label: "Mark rejected" },
    ],
    accepted: [],
    rejected: [],
  },
  lockOn: ["approved", "sent", "accepted", "rejected"],
  discountApprovalPct: 10,
  minMarginPct: 8,
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_technical: "Pending technical approval",
  pending_commercial: "Pending commercial approval",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
};
