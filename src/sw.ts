/// <reference lib="webworker" />
import {
  precacheAndRoute,
  createHandlerBoundToURL,
  getCacheKeyForURL,
} from "workbox-precaching";
import { cacheNames } from "workbox-core";
import { registerRoute, NavigationRoute } from "workbox-routing";
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
};
const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    allowlist: [/^\/$/, /^\/index\.html$/],
  }),
);
// Intentionally no skipWaiting/clientsClaim: updates activate only after all old tabs close.
// This also prevents an idle tab replacing the assets of an active or unresponsive tab.
self.addEventListener("message", (event) => {
  if (
    !["CHECK_OFFLINE_READY", "REPAIR_OFFLINE_CACHE"].includes(event.data?.type)
  )
    return;
  event.waitUntil(
    (async () => {
      const repair = event.data.type === "REPAIR_OFFLINE_CACHE";
      const cache = await caches.open(cacheNames.precache);
      const present = await Promise.all(
        manifest.map(async (entry) => {
          const url = typeof entry === "string" ? entry : entry.url;
          const key = getCacheKeyForURL(url);
          if (!key) return false;
          if (await cache.match(key)) return true;
          if (!repair) return false;
          try {
            const response = await fetch(new URL(url, self.location.href), {
              cache: "reload",
              integrity:
                typeof entry === "string" ? undefined : entry.integrity,
            });
            if (!response.ok) return false;
            await cache.put(key, response);
            return true;
          } catch {
            return false;
          }
        }),
      );
      event.ports[0]?.postMessage({
        ready: present.length > 0 && present.every(Boolean),
      });
    })(),
  );
});
