const AUTH_KEY = "nextstage-prototype-auth-v1";
const SESSION_KEY = "nextstage-prototype-session-v1";

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function derivePasswordHash(password, salt, iterations = 150000) {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(bits));
}

function normalizeUsername(username = "") {
  return String(username)
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

export function getLocalAccount() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getLocalSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isPrototypeSignedIn() {
  const account = getLocalAccount();
  const session = getLocalSession();

  return Boolean(
    account &&
    session &&
    session.signedIn === true &&
    session.accountId === account.id
  );
}

export async function createLocalAccount({
  email,
  username,
  password,
  firstName = "",
  lastName = "",
  displayName = ""
}) {
  if (getLocalAccount()) {
    throw new Error("A prototype account already exists on this browser.");
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanUsername = normalizeUsername(username);

  if (!cleanEmail || !cleanUsername || !password) {
    throw new Error("Email, username, and password are required.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 150000;
  const passwordHash = await derivePasswordHash(
    password,
    salt,
    iterations
  );

  const account = {
    id: "local-prototype-account",
    email: cleanEmail,
    username: cleanUsername,
    firstName: String(firstName || "").trim(),
    lastName: String(lastName || "").trim(),
    displayName: String(displayName || "").trim(),
    passwordHash,
    salt: bytesToBase64(salt),
    iterations,
    createdAt: new Date().toISOString()
  };

  localStorage.setItem(AUTH_KEY, JSON.stringify(account));

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accountId: account.id,
      signedIn: true,
      signedInAt: new Date().toISOString()
    })
  );

  return account;
}

export async function signInLocalAccount({ email, password }) {
  const account = getLocalAccount();

  if (!account) {
    throw new Error("No prototype account exists on this browser.");
  }

  const cleanEmail = String(email || "").trim().toLowerCase();

  if (cleanEmail !== account.email) {
    throw new Error("Email or password is incorrect.");
  }

  const passwordHash = await derivePasswordHash(
    password,
    base64ToBytes(account.salt),
    account.iterations
  );

  if (passwordHash !== account.passwordHash) {
    throw new Error("Email or password is incorrect.");
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accountId: account.id,
      signedIn: true,
      signedInAt: new Date().toISOString()
    })
  );

  return account;
}

export function signOutLocalAccount() {
  localStorage.removeItem(SESSION_KEY);
}

export function deleteLocalAccount() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(SESSION_KEY);
}
