const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function resolveTenantSlugFromHost(hostHeader: string | null): string {
  const fallback = process.env.NUTRIOS_DEFAULT_TENANT_SLUG ?? "maria";
  if (!hostHeader) return fallback;

  const host = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  if (!host || LOCAL_HOSTS.has(host)) return fallback;

  const rootDomain = process.env.NUTRIOS_ROOT_DOMAIN?.toLowerCase();
  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    const subdomain = host.slice(0, -rootDomain.length - 1);
    return sanitizeTenantSlug(subdomain.split(".")[0] ?? fallback);
  }

  const parts = host.split(".");
  if (parts.length > 2) return sanitizeTenantSlug(parts[0] ?? fallback);

  return fallback;
}

export function sanitizeTenantSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "maria"
  );
}
