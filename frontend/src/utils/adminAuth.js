const ADMIN_PASSWORD_KEY = "aidchain_admin_password";

export function getAdminPassword() {
  return window.localStorage.getItem(ADMIN_PASSWORD_KEY) || "";
}

export function setAdminPassword(password) {
  if (password) {
    window.localStorage.setItem(ADMIN_PASSWORD_KEY, password);
  }
}

export function clearAdminPassword() {
  window.localStorage.removeItem(ADMIN_PASSWORD_KEY);
}

export function ensureAdminPassword() {
  const existing = getAdminPassword();
  if (existing) {
    return existing;
  }

  const entered = window.prompt("Enter the admin password");
  if (!entered) {
    throw new Error("Admin password is required.");
  }

  setAdminPassword(entered);
  return entered;
}

export function getAdminHeaders() {
  return { "X-Admin-Password": ensureAdminPassword() };
}
