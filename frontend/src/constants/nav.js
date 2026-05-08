/**
 * Shared navigation constants for sidebar menus.
 * Centralized to avoid duplication across admin pages and NGO pages.
 *
 * Only include items that link to real, implemented routes.
 */

export const ADMIN_NAV = [
  { icon: "dashboard", label: "Dashboard", id: "admin-dash", href: "#/admin" },
  { icon: "verified_user", label: "NGO Applications", id: "ngo-apps", href: "#/admin/ngo-apps" },
  { icon: "diversity_3", label: "Crisis Pools", id: "create-pool", href: "#/admin/create-pool" },
];

export const NGO_NAV = [
  { icon: "dashboard", label: "Dashboard", id: "dashboard", href: "#/ngo/dashboard" },
  { icon: "browse_activity", label: "Browse Pools", id: "pools", href: "#/pools" },
  { icon: "upload_file", label: "Submit Proof", id: "submit-proof", href: "#/ngo/submit-proof" },
  { icon: "pending_actions", label: "Application Status", id: "status", href: "#/ngo/status" },
];
