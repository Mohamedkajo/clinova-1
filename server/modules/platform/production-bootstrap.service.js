import { currentSchemaVersion, db } from "../../db.js";
import { ProductionInitError } from "../../production-init-input.js";
import {
  auditPlatformTenantCreate,
  auditProductionInitialization,
  createInitialPlatformOwner,
  currentMigrationExists,
  lockProductionInitialization,
  productionInitializationState,
  removeProductionBootstrapTenant,
} from "./platform-provisioning.repository.js";
import { provisionInitialPlatformTenant } from "./platform-provisioning.service.js";

export async function initializeProductionInstallation(input, options = {}) {
  const database = options.database || db;
  return database.transaction(async (connection) => {
    await lockProductionInitialization(connection);
    if (!await currentMigrationExists(connection, currentSchemaVersion)) {
      throw new ProductionInitError("PRODUCTION_MIGRATIONS_NOT_CURRENT");
    }

    const state = await productionInitializationState(connection, {
      usernames: [input.platform.username.toLowerCase(), input.clinic.administrator.username.toLowerCase()],
      emails: [input.platform.email, input.clinic.administrator.email],
      slug: input.clinic.slug,
    });
    if (state.activeOwners > 0) throw new ProductionInitError("PRODUCTION_ALREADY_INITIALIZED");
    if (state.usernameConflict) throw new ProductionInitError("PRODUCTION_CONFLICT_USERNAME");
    if (state.emailConflict) throw new ProductionInitError("PRODUCTION_CONFLICT_EMAIL");
    if (state.slugConflict && state.bootstrapTenantId === null) throw new ProductionInitError("PRODUCTION_CONFLICT_TENANT_SLUG");
    const empty = state.tenants === 0 && state.users === 0 && state.owners === 0;
    const knownBootstrapOnly = state.bootstrapTenantId !== null && state.users === 0 && state.owners === 0;
    if (!empty && !knownBootstrapOnly) throw new ProductionInitError("PRODUCTION_PARTIAL_STATE");

    if (knownBootstrapOnly) await removeProductionBootstrapTenant(connection, state.bootstrapTenantId);
    const provisioned = await provisionInitialPlatformTenant({
      clinicName: input.clinic.name,
      slug: input.clinic.slug,
      ownerName: input.clinic.administrator.name,
      username: input.clinic.administrator.username,
      email: input.clinic.administrator.email,
      password: input.clinic.administrator.password,
    }, connection);

    if (options.afterTenantProvisioned) await options.afterTenantProvisioned(provisioned);
    const platformOwnerId = await createInitialPlatformOwner(connection, provisioned.tenant.id, input.platform);
    const actor = { id: platformOwnerId, tenantId: provisioned.tenant.id };
    await auditPlatformTenantCreate(actor, provisioned.tenant.id, "starter", "trial", connection);
    await auditProductionInitialization(connection, platformOwnerId, provisioned.tenant.id);

    return {
      status: "PRODUCTION_INITIALIZED",
      platformOwner: { id: platformOwnerId, username: input.platform.username },
      clinic: {
        id: Number(provisioned.tenant.id),
        slug: provisioned.tenant.slug,
        administrator: { id: Number(provisioned.user.id), username: input.clinic.administrator.username },
      },
    };
  });
}
