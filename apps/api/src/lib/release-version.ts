/** Return only a Git SHA suitable for public release diagnostics. */
export function releaseGitSha(value = process.env.BUILD_GIT_SHA ?? process.env.RENDER_GIT_COMMIT): string {
  if (typeof value !== "string") return "unknown";
  const sha = value.trim();
  return /^[a-f0-9]{7,40}$/i.test(sha) ? sha.toLowerCase() : "unknown";
}
