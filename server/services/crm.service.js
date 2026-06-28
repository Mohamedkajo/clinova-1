import {
  addCrmEvent,
  assignedUserExists,
  auditCrmTask,
  clientExists,
  createCrmTask,
  crmTaskById,
  listCrmEventRows,
  listCrmTaskRows,
  updateClientLastContacted,
  updateCrmTask,
} from "../repositories/crm.repository.js";
import { isValidIsoDate } from "../shared/validation/date-time.js";

function validOptionalDate(value) {
  return value === undefined || value === null || value === "" || isValidIsoDate(value);
}

function hasExplicitValue(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined && body[field] !== null && body[field] !== "";
}

function validateCrmTaskEnums(body) {
  if (hasExplicitValue(body, "status") && !["open", "done", "cancelled"].includes(body.status)) {
    return { status: 400, body: { error: "Valid CRM status is required." } };
  }
  if (hasExplicitValue(body, "priority") && !["low", "normal", "high"].includes(body.priority)) {
    return { status: 400, body: { error: "Valid CRM priority is required." } };
  }
  return null;
}

export async function getCrm(user) {
  return {
    status: 200,
    body: {
      tasks: await listCrmTaskRows(user),
      events: await listCrmEventRows(user),
    },
  };
}

export async function getCrmTasks(user) {
  return { status: 200, body: await listCrmTaskRows(user) };
}

export async function addCrmTask(user, body) {
  if (!validOptionalDate(body.dueDate)) {
    return { status: 400, body: { error: "Valid due date is required." } };
  }
  const enumValidation = validateCrmTaskEnums(body);
  if (enumValidation) return enumValidation;
  if (!await clientExists(body.clientId, user.tenantId)) {
    return { status: 404, body: { error: "Client not found." } };
  }
  const assignedTo = body.assignedTo || user.id;
  if (!await assignedUserExists(assignedTo, user.tenantId)) {
    return { status: 404, body: { error: "User not found." } };
  }
  const title = body.title || "Follow up";
  const id = await createCrmTask({
    tenantId: user.tenantId,
    clientId: body.clientId,
    assignedTo,
    type: body.type || "follow_up",
    title,
    dueDate: body.dueDate || null,
    priority: body.priority || "normal",
    notes: body.notes || "",
  });
  await addCrmEvent({ tenantId: user.tenantId, clientId: body.clientId, userId: user.id, type: "task_created", description: title });
  await auditCrmTask(user.id, "create", id, user.tenantId);
  return { status: 201, body: { id } };
}

export async function editCrmTask(user, id, body) {
  if (!validOptionalDate(body.dueDate)) {
    return { status: 400, body: { error: "Valid due date is required." } };
  }
  const enumValidation = validateCrmTaskEnums(body);
  if (enumValidation) return enumValidation;
  const task = await crmTaskById(id, user.tenantId);
  if (!task) return { status: 404, body: { error: "Task not found." } };
  if (user.role === "therapist" && Number(task.assigned_to || 0) !== Number(user.id)) {
    return { status: 404, body: { error: "Task not found." } };
  }
  const assignedTo = body.assignedTo || user.id;
  if (!await assignedUserExists(assignedTo, user.tenantId)) {
    return { status: 404, body: { error: "User not found." } };
  }
  const status = ["open", "done", "cancelled"].includes(body.status) ? body.status : "open";
  const title = body.title || "Follow up";
  await updateCrmTask(id, user.tenantId, {
    assignedTo,
    type: body.type || "follow_up",
    title,
    dueDate: body.dueDate || null,
    status,
    priority: body.priority || "normal",
    notes: body.notes || "",
  });
  if (status === "done") await updateClientLastContacted(task.client_id, user.tenantId);
  await addCrmEvent({ tenantId: user.tenantId, clientId: task.client_id, userId: user.id, type: "task_updated", description: `${title} (${status})` });
  await auditCrmTask(user.id, "update", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
