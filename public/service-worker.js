/**
 * Service Worker for offline capability
 * Caches static assets and API responses for offline access
 */

const CACHE_NAME = "pricepilot-admin-v1";
const STATIC_CACHE = "pricepilot-static-v1";
const API_CACHE = "pricepilot-api-v1";

// Static assets to cache
const STATIC_ASSETS = [
    "/",
    "/admin",
    "/admin/monitor",
    "/admin/metrics",
    "/admin/health",
];

// API endpoints to cache (with short TTL)
const API_ENDPOINTS = [
    "/api/v1/admin/sessions",
    "/api/v1/admin/metrics/dashboard",
    "/api/v1/admin/health",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
    console.log("[Service Worker] Installing...");

    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log("[Service Worker] Caching static assets");
            return cache.addAll(STATIC_ASSETS);
        })
    );

    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
    console.log("[Service Worker] Activating...");

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (
                        cacheName !== CACHE_NAME &&
                        cacheName !== STATIC_CACHE &&
                        cacheName !== API_CACHE
                    ) {
                        console.log("[Service Worker] Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );

    // Take control immediately
    return self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== "GET") {
        return;
    }

    // Handle API requests
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle static assets
    event.respondWith(handleStaticRequest(request));
});

/**
 * Handle API requests with network-first strategy
 * Falls back to cache if network fails
 */
async function handleApiRequest(request) {
    const cache = await caches.open(API_CACHE);

    try {
        // Try network first
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // Network failed, try cache
        console.log("[Service Worker] Network failed, trying cache:", request.url);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            // Add header to indicate cached response
            const headers = new Headers(cachedResponse.headers);
            headers.set("X-Cached", "true");

            return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: headers,
            });
        }

        // No cache available, return error
        return new Response(
            JSON.stringify({
                success: false,
                error: "Network unavailable and no cached data",
                offline: true,
            }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}

/**
 * Handle static requests with cache-first strategy
 * Falls back to network if not in cache
 */
async function handleStaticRequest(request) {
    const cache = await caches.open(STATIC_CACHE);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    // Not in cache, try network
    try {
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // Both cache and network failed
        console.error("[Service Worker] Failed to fetch:", request.url, error);

        // Return offline page or error
        return new Response("Offline - Resource not available", {
            status: 503,
            statusText: "Service Unavailable",
        });
    }
}

// Message event - handle commands from clients
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }

    if (event.data && event.data.type === "CLEAR_CACHE") {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});
