/** The offline read cache holds one person's days and events: empty it whenever the signed-in person can change. */
export async function clearReadCache(): Promise<void> {
  try { if (typeof caches !== 'undefined') await caches.delete('evo-api'); } catch { /* the cache is optional */ }
}
