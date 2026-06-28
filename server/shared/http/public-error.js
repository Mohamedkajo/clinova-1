const genericProductionError = "Internal server error.";

export function publicErrorResponse(error, nodeEnv = process.env.NODE_ENV) {
  const status = error.status || 500;
  if (status === 500 && nodeEnv === "production") {
    return { status, body: { error: genericProductionError } };
  }
  return {
    status,
    body: { error: error.message || genericProductionError },
  };
}
