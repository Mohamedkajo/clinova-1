import {
  auditGift,
  createGiftCard,
  giftClientExists,
  giftServiceExists,
  listGiftCards,
  updateGiftCardStatus,
} from "./gifts.repository.js";

function validOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return true;
  const validType = typeof value === "number" || typeof value === "string";
  return validType && !(typeof value === "string" && value.trim() === "") && Number.isFinite(Number(value));
}

function hasExplicitValue(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined && body[field] !== null && body[field] !== "";
}

export async function getGifts(user) {
  return { status: 200, body: await listGiftCards(user.tenantId) };
}

export async function addGift(user, body) {
  if (!validOptionalNumber(body.sessions)) {
    return { status: 400, body: { error: "Valid gift sessions are required." } };
  }
  if (!await giftClientExists(body.fromClientId, user.tenantId)
      || !await giftClientExists(body.toClientId, user.tenantId)) {
    return { status: 404, body: { error: "Client not found." } };
  }
  if (!await giftServiceExists(body.serviceId, user.tenantId)) {
    return { status: 404, body: { error: "Service not found." } };
  }

  const code = `GIFT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const id = await createGiftCard(user.tenantId, code, body);
  await auditGift(user.id, "create", id, user.tenantId);
  return { status: 201, body: { id, code } };
}

export async function editGift(user, id, body) {
  if (hasExplicitValue(body, "status") && !["active", "redeemed", "cancelled"].includes(body.status)) {
    return { status: 400, body: { error: "Valid gift status is required." } };
  }
  const changes = await updateGiftCardStatus(id, user.tenantId, body.status || "active");
  if (!changes) return { status: 404, body: { error: "Gift card not found." } };
  await auditGift(user.id, "update", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
