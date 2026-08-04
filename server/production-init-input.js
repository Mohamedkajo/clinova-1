const requiredNames = Object.freeze([
  "INIT_PLATFORM_USERNAME",
  "INIT_PLATFORM_EMAIL",
  "INIT_PLATFORM_NAME",
  "INIT_PLATFORM_PASSWORD",
  "INIT_CLINIC_NAME",
  "INIT_CLINIC_SLUG",
  "INIT_CLINIC_ADMIN_USERNAME",
  "INIT_CLINIC_ADMIN_EMAIL",
  "INIT_CLINIC_ADMIN_NAME",
  "INIT_CLINIC_ADMIN_PASSWORD",
]);

const knownDemoUsernames = new Set(["admin", "owner", "reception", "sara", "lina"]);
const knownDemoPasswords = new Set(["changeme123!", "clinovaalphademo!"]);
const placeholderSecret = /^(?:change[-_ ]?me|replace[-_ ]?with|password|secret|demo|example)(?:$|[-_ !0-9].*)/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[\p{L}\p{N}._@+-]+$/u;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ProductionInitError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function normalized(env, name) {
  return String(env[name] || "").trim();
}

function validateName(value, field, errors) {
  if (value.length < 2 || value.length > 120 || /[\u0000-\u001f\u007f]/.test(value)) errors.push(field);
}

function validateUsername(value, field, errors) {
  if (value.length < 2 || value.length > 80 || !usernamePattern.test(value)) errors.push(field);
  if (knownDemoUsernames.has(value.toLowerCase())) errors.push(`${field}_DEMO`);
}

function validateEmail(value, field, errors) {
  if (value.length > 254 || !emailPattern.test(value)) errors.push(field);
}

function validatePassword(value, field, errors) {
  if (value.length < 8) errors.push(`${field}_WEAK`);
  if (knownDemoPasswords.has(value.toLowerCase()) || placeholderSecret.test(value)) errors.push(`${field}_DEMO_OR_PLACEHOLDER`);
}

export function readProductionInitInput(env = process.env) {
  const missing = requiredNames.filter((name) => !normalized(env, name));
  if (missing.length) throw new ProductionInitError(`PRODUCTION_INIT_INPUT_MISSING:${missing.join(",")}`);

  const input = {
    platform: {
      username: normalized(env, "INIT_PLATFORM_USERNAME"),
      email: normalized(env, "INIT_PLATFORM_EMAIL").toLowerCase(),
      name: normalized(env, "INIT_PLATFORM_NAME"),
      password: String(env.INIT_PLATFORM_PASSWORD || ""),
    },
    clinic: {
      name: normalized(env, "INIT_CLINIC_NAME"),
      slug: normalized(env, "INIT_CLINIC_SLUG").toLowerCase(),
      administrator: {
        username: normalized(env, "INIT_CLINIC_ADMIN_USERNAME"),
        email: normalized(env, "INIT_CLINIC_ADMIN_EMAIL").toLowerCase(),
        name: normalized(env, "INIT_CLINIC_ADMIN_NAME"),
        password: String(env.INIT_CLINIC_ADMIN_PASSWORD || ""),
      },
    },
  };

  const errors = [];
  validateUsername(input.platform.username, "INIT_PLATFORM_USERNAME", errors);
  validateEmail(input.platform.email, "INIT_PLATFORM_EMAIL", errors);
  validateName(input.platform.name, "INIT_PLATFORM_NAME", errors);
  validatePassword(input.platform.password, "INIT_PLATFORM_PASSWORD", errors);
  validateName(input.clinic.name, "INIT_CLINIC_NAME", errors);
  if (input.clinic.slug.length > 48 || !slugPattern.test(input.clinic.slug)) errors.push("INIT_CLINIC_SLUG");
  if (input.clinic.slug === "demo" || /\bdemo\b/i.test(input.clinic.name)) errors.push("INIT_CLINIC_DEMO");
  validateUsername(input.clinic.administrator.username, "INIT_CLINIC_ADMIN_USERNAME", errors);
  validateEmail(input.clinic.administrator.email, "INIT_CLINIC_ADMIN_EMAIL", errors);
  validateName(input.clinic.administrator.name, "INIT_CLINIC_ADMIN_NAME", errors);
  validatePassword(input.clinic.administrator.password, "INIT_CLINIC_ADMIN_PASSWORD", errors);
  if (input.platform.username.toLowerCase() === input.clinic.administrator.username.toLowerCase()) errors.push("INIT_USERNAME_CONFLICT");
  if (input.platform.email === input.clinic.administrator.email) errors.push("INIT_EMAIL_CONFLICT");
  if (errors.length) throw new ProductionInitError(`PRODUCTION_INIT_INPUT_INVALID:${[...new Set(errors)].join(",")}`);
  return input;
}

export function clearProductionInitEnvironment(env = process.env) {
  for (const name of requiredNames) delete env[name];
}

export function safeProductionInitCode(error) {
  return error instanceof ProductionInitError && error.code
    ? error.code
    : "PRODUCTION_INITIALIZATION_FAILED";
}
