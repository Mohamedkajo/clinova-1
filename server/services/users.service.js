import { hashPassword } from "../security.js";
import {
  auditUser,
  createUser,
  deactivateUser,
  deleteUserSessions,
  findManagedUser,
  listUsers,
  tenantBillingSnapshot,
  updateUser,
} from "../repositories/users.repository.js";

const planCatalog = {
  starter: { name: "Starter", monthlyPrice: 49, maxUsers: 5, maxClients: 200, whatsapp: false, billing: false },
  growth: { name: "Growth", monthlyPrice: 99, maxUsers: 10, maxClients: 2000, whatsapp: true, billing: false },
  scale: { name: "Scale", monthlyPrice: 199, maxUsers: null, maxClients: null, whatsapp: true, billing: true },
};

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parseJsonArray(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function validRole(value) {
  return ["admin", "reception", "therapist"].includes(value);
}

function limitReached(current, max) {
  return max !== null && max !== undefined && Number(current || 0) >= Number(max);
}

async function assertTenantCanWrite(tenantId, feature = "write") {
  const billing = await tenantBillingSnapshot(tenantId);
  if (["suspended", "cancelled", "past_due"].includes(billing.status)) {
    const error = new Error(`Subscription status blocks ${feature}.`);
    error.status = 402;
    throw error;
  }
  return {
    ...billing,
    limits: planCatalog[billing.plan] || planCatalog.starter,
  };
}

function userValues(body) {
  return {
    username: String(body.username || "").trim(),
    email: normalizeEmail(body.email),
    name: body.name,
    title: body.title || "",
    role: body.role,
    workdays: parseJsonArray(body.workdays),
    serviceIds: parseJsonArray(body.serviceIds),
    active: body.active === false ? 0 : 1,
  };
}

export async function getUsers(user) {
  return { status: 200, body: await listUsers(user.tenantId) };
}

export async function addUser(user, body) {
  const billing = await assertTenantCanWrite(user.tenantId, "team creation");
  if (limitReached(billing.usage.users, billing.limits.maxUsers)) {
    return { status: 402, body: { error: `Plan user limit reached (${billing.limits.maxUsers}).` } };
  }
  if (!body.password || String(body.password).length < 8) {
    return { status: 400, body: { error: "Password must be at least 8 characters." } };
  }
  if (!body.username || String(body.username).trim().length < 2) {
    return { status: 400, body: { error: "Username is required." } };
  }
  if (body.name === undefined || body.name === null || body.role === undefined || body.role === null) {
    return { status: 400, body: { error: "Name and role are required." } };
  }
  if (!validRole(body.role)) {
    return { status: 400, body: { error: "Valid role is required." } };
  }
  const id = await createUser(user.tenantId, {
    ...userValues(body),
    passwordHash: hashPassword(body.password),
  });
  await auditUser(user.id, "create", id, user.tenantId);
  return { status: 201, body: { id } };
}

export async function editUser(user, id, body) {
  const currentRow = await findManagedUser(id, user.tenantId);
  if (!currentRow) return { status: 404, body: { error: "User not found." } };
  if (currentRow.isPlatformOwner) return { status: 403, body: { error: "Platform owner cannot be managed from clinic users." } };
  if (body.name === undefined || body.name === null || String(body.name).trim() === "" || body.role === undefined || body.role === null) {
    return { status: 400, body: { error: "Name and role are required." } };
  }
  if (Object.prototype.hasOwnProperty.call(body, "role") && !validRole(body.role)) {
    return { status: 400, body: { error: "Valid role is required." } };
  }

  const values = userValues({
    ...body,
    email: Object.prototype.hasOwnProperty.call(body, "email") ? body.email : (currentRow.email || ""),
  });
  if (body.password) values.passwordHash = hashPassword(body.password);

  await updateUser(id, user.tenantId, values);
  if (values.passwordHash) await deleteUserSessions(id, user.tenantId);
  await auditUser(user.id, "update", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}

export async function removeUser(user, id) {
  const currentRow = await findManagedUser(id, user.tenantId);
  if (!currentRow) return { status: 404, body: { error: "User not found." } };
  if (currentRow.isPlatformOwner) return { status: 403, body: { error: "Platform owner cannot be managed from clinic users." } };

  await deactivateUser(id, user.tenantId);
  await auditUser(user.id, "deactivate", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
