/**
 * Service Worker registration utility
 * Handles registration and lifecycle management
 */

export interface ServiceWorkerConfig {
    onSuccess?: (registration: ServiceWorkerRegistration) => void;
    onUpdate?: (registration: ServiceWorkerRegistration) => void;
    onError?: (error: Error) => void;
}

/**
 * Register service worker
 * @param config - Configuration callbacks
 */
export async function registerServiceWorker(
    config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | null> {
    // Check if service workers are supported
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        console.log("Service workers are not supported");
        return null;
    }

    // Only register in production
    if (process.env.NODE_ENV !== "production") {
        console.log("Service worker registration skipped in development");
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register(
            "/service-worker.js",
            {
                scope: "/",
            }
        );

        console.log("Service worker registered:", registration.scope);

        // Handle updates
        registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed") {
                    if (navigator.serviceWorker.controller) {
                        // New service worker available
                        console.log("New service worker available");
                        if (config.onUpdate) {
                            config.onUpdate(registration);
                        }
                    } else {
                        // Service worker installed for the first time
                        console.log("Service worker installed");
                        if (config.onSuccess) {
                            config.onSuccess(registration);
                        }
                    }
                }
            });
        });

        return registration;
    } catch (error) {
        console.error("Service worker registration failed:", error);
        if (config.onError && error instanceof Error) {
            config.onError(error);
        }
        return null;
    }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const success = await registration.unregister();
        console.log("Service worker unregistered:", success);
        return success;
    } catch (error) {
        console.error("Service worker unregistration failed:", error);
        return false;
    }
}

/**
 * Check if service worker is registered
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
    } catch (error) {
        return false;
    }
}

/**
 * Update service worker
 */
export async function updateServiceWorker(): Promise<void> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        console.log("Service worker update triggered");
    } catch (error) {
        console.error("Service worker update failed:", error);
    }
}

/**
 * Clear service worker cache
 */
export async function clearServiceWorkerCache(): Promise<void> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
            registration.active.postMessage({ type: "CLEAR_CACHE" });
            console.log("Service worker cache clear requested");
        }
    } catch (error) {
        console.error("Failed to clear service worker cache:", error);
    }
}

/**
 * Check if app is running offline
 */
export function isOffline(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    return !navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function onConnectionChange(
    callback: (isOnline: boolean) => void
): () => void {
    if (typeof window === "undefined") {
        return () => { };
    }

    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Return cleanup function
    return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
    };
}
