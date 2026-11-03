/**
 * Emergency migration-window switch. When enabled, project deletion is
 * rejected before reading or mutating any project/order rows.
 */
export function isProjectDeletionPaused(value = process.env.PROJECT_DELETION_PAUSED): boolean {
  return value?.trim().toLowerCase() === "true";
}
