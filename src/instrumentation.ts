export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./instrumentation-node");
    await runMigrations();
    const { startGoogleSyncTimer } = await import("./lib/google-sync");
    startGoogleSyncTimer();
  }
}
