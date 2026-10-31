/** Public main-site address, never a database URL or credential. */
export const pluggSiteUrl = (import.meta.env.VITE_PLUGG_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
