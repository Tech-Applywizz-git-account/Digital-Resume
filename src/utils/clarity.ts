/**
 * Safe Multi-Tenant Clarity Manager
 * ------------------------------------------------------------------
 * Provisions, mounts, and purges Microsoft Clarity telemetry.
 * Purges Clarity cookies, local/session storage, and DOM elements
 * to prevent multi-profile session collision on the same domain.
 * Enforces strict network-level route boundaries so Clarity can
 * NEVER track non-Career-Identity pages (e.g. when client navigates back).
 */

declare global {
    interface Window {
        clarity?: (...args: any[]) => void;
    }
}

let activeLoadedProjectId: string | null = null;
let routeGuardInstalled = false;

/**
 * Installs network-level guards on sendBeacon, fetch, XMLHttpRequest,
 * and browser navigation (popstate, pushState, replaceState) to guarantee
 * that Microsoft Clarity packets are NEVER transmitted when outside
 * the allowed /career-identity/ route.
 */
export function installClarityRouteGuard(): void {
    if (typeof window === 'undefined' || routeGuardInstalled) return;
    routeGuardInstalled = true;

    // 1. Guard navigator.sendBeacon
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const originalSendBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null): boolean {
            const urlStr = String(url);
            if (urlStr.includes('clarity.ms')) {
                // If not currently on a public career-identity profile, drop transmission
                if (!window.location.pathname.startsWith('/career-identity/')) {
                    return true; // Return true so caller assumes delivery and does not retry
                }
            }
            return originalSendBeacon(url, data);
        };
    }

    // 2. Guard window.fetch
    if (typeof window.fetch === 'function') {
        const originalFetch = window.fetch;
        window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
            if (urlStr.includes('clarity.ms')) {
                if (!window.location.pathname.startsWith('/career-identity/')) {
                    // Silently drop and return mock successful 204 response
                    return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
                }
            }
            return originalFetch.apply(this, arguments as any);
        };
    }

    // 3. Guard XMLHttpRequest
    if (typeof window.XMLHttpRequest !== 'undefined') {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (
            method: string,
            url: string | URL,
            asyncVal: boolean = true,
            username?: string | null,
            password?: string | null
        ): void {
            (this as any).__clarity_intercept_url = String(url);
            return originalOpen.call(this, method, url, asyncVal, username, password);
        };

        XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
            const url = (this as any).__clarity_intercept_url || '';
            if (url.includes('clarity.ms')) {
                if (!window.location.pathname.startsWith('/career-identity/')) {
                    try {
                        Object.defineProperty(this, 'readyState', { value: 4, writable: true, configurable: true });
                        Object.defineProperty(this, 'status', { value: 204, writable: true, configurable: true });
                        Object.defineProperty(this, 'statusText', { value: 'No Content', writable: true, configurable: true });
                        Object.defineProperty(this, 'responseText', { value: '', writable: true, configurable: true });
                    } catch {
                        // ignore property definition edge cases
                    }
                    if (typeof this.onreadystatechange === 'function') {
                        try { this.onreadystatechange(new Event('readystatechange')); } catch {}
                    }
                    if (typeof this.onload === 'function') {
                        try { this.onload(new ProgressEvent('load')); } catch {}
                    }
                    if (typeof this.onloadend === 'function') {
                        try { this.onloadend(new ProgressEvent('loadend')); } catch {}
                    }
                    return;
                }
            }
            return originalSend.call(this, body);
        };
    }

    // 4. Intercept history pushState and replaceState (in-app SPA transitions)
    if (typeof window.history !== 'undefined') {
        const originalPushState = window.history.pushState.bind(window.history);
        window.history.pushState = function (data: any, unused: string, url?: string | URL | null): void {
            originalPushState(data, unused, url);
            if (url) {
                const targetPath = typeof url === 'string'
                    ? (url.startsWith('http') ? new URL(url).pathname : url.split('?')[0])
                    : url.pathname;
                if (!targetPath.startsWith('/career-identity/')) {
                    detectAndForceClearClarityData();
                }
            }
        };

        const originalReplaceState = window.history.replaceState.bind(window.history);
        window.history.replaceState = function (data: any, unused: string, url?: string | URL | null): void {
            originalReplaceState(data, unused, url);
            if (url) {
                const targetPath = typeof url === 'string'
                    ? (url.startsWith('http') ? new URL(url).pathname : url.split('?')[0])
                    : url.pathname;
                if (!targetPath.startsWith('/career-identity/')) {
                    detectAndForceClearClarityData();
                }
            }
        };
    }

    // 5. Listen to browser popstate (back / forward navigation)
    window.addEventListener('popstate', () => {
        if (!window.location.pathname.startsWith('/career-identity/')) {
            detectAndForceClearClarityData();
        }
    });

    // 6. Auto-clean on initial page load if not on /career-identity/
    if (!window.location.pathname.startsWith('/career-identity/')) {
        detectAndForceClearClarityData();
    }
}

/**
 * Completely purges Clarity in-memory observers, cookies, storage,
 * and DOM elements to ensure a fresh, pristine environment.
 */
export function detectAndForceClearClarityData(): boolean {
    if (typeof window === 'undefined') return false;
    let foundAndCleared = false;

    // 1. Halt running in-memory Clarity engine & disconnect observers
    if (typeof window.clarity === 'function') {
        try {
            window.clarity('stop');
            window.clarity('pause');
            (window.clarity as any)('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
            window.clarity('consent', false);
        } catch {
            // Non-fatal
        }
        foundAndCleared = true;
    }

    // 2. Lock window.clarity with a dead stub so deferred/async scripts cannot re-enable tracking
    const deadStub = function (..._args: any[]) { /* blocked outside career-identity */ };
    (deadStub as any).q = [];
    (deadStub as any).v = null;
    try {
        window.clarity = deadStub;
    } catch {
        // Non-fatal
    }

    // 3. Scan and force-wipe all Clarity cookies across domain and path variations
    if (typeof document !== 'undefined' && document.cookie) {
        const cookies = document.cookie.split(';');
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        const domainVariations: string[] = ['', hostname, `.${hostname}`];
        if (parts.length >= 2) {
            const apex = parts.slice(-2).join('.');
            domainVariations.push(apex, `.${apex}`);
        }
        const pathVariations = ['/', window.location.pathname];

        for (const cookieItem of cookies) {
            const cookieName = cookieItem.split('=')[0].trim();
            if (cookieName.startsWith('_cl') || cookieName.toLowerCase().includes('clarity')) {
                foundAndCleared = true;
                for (const dom of domainVariations) {
                    for (const p of pathVariations) {
                        const domainStr = dom ? `; domain=${dom}` : '';
                        document.cookie = `${cookieName}=; path=${p}${domainStr}; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;`;
                    }
                }
            }
        }
    }

    // 4. Scan & force-clear sessionStorage and localStorage
    try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith('_cl') || key.toLowerCase().includes('clarity'))) {
                sessionStorage.removeItem(key);
                foundAndCleared = true;
            }
        }
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('_cl') || key.toLowerCase().includes('clarity'))) {
                localStorage.removeItem(key);
                foundAndCleared = true;
            }
        }
    } catch {
        // Non-fatal if storage access is restricted
    }

    // 5. Remove script elements from DOM
    if (typeof document !== 'undefined') {
        const scripts = document.querySelectorAll('script[src*="clarity.ms"], script#clarity-script');
        if (scripts.length > 0) {
            scripts.forEach((el) => el.remove());
            foundAndCleared = true;
        }
    }

    activeLoadedProjectId = null;
    return foundAndCleared;
}

export interface ClarityMountMetadata {
    castId: string;
    candidateId?: string | null;
    viewerRole: 'owner' | 'admin' | 'other_client' | 'unknown_visitor';
    source: string;
    theme?: string | null;
}

/**
 * Mounts the candidate-specific Clarity project on the public page.
 * Forces a cookie wipe first to guarantee isolation from prior client visits.
 */
export function mountClientClarity(projectId: string, metadata: ClarityMountMetadata): void {
    if (typeof window === 'undefined' || !projectId) return;

    // Strict route check: only allow mounting on /career-identity/
    if (!window.location.pathname.startsWith('/career-identity/')) {
        return;
    }

    // Always ensure the route guard is active
    installClarityRouteGuard();

    if (activeLoadedProjectId === projectId && typeof window.clarity === 'function' && (window.clarity as any).v) {
        return;
    }

    // Always start with a 100% clean browser slate
    detectAndForceClearClarityData();

    // Re-initialize window.clarity as an active queue stub so initial commands are properly queued
    const queueStub = function (...args: any[]) {
        ((queueStub as any).q = (queueStub as any).q || []).push(args);
    };
    (queueStub as any).q = [];
    (queueStub as any).v = null;
    try {
        window.clarity = queueStub;
    } catch {
        // Non-fatal
    }

    // Standard asynchronous Clarity snippet with project ID
    (function (c: any, l: Document, a: string, r: string, i: string, t?: any, y?: any) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r);
        t.id = 'clarity-script';
        t.async = 1;
        t.src = `https://www.clarity.ms/tag/${i}`;
        y = l.getElementsByTagName(r)[0];
        if (y && y.parentNode) {
            y.parentNode.insertBefore(t, y);
        } else {
            l.head.appendChild(t);
        }
    })(window, document, 'clarity', 'script', projectId);

    activeLoadedProjectId = projectId;

    if (typeof window.clarity === 'function') {
        window.clarity('consent', true);
        window.clarity('set', 'viewer_role', metadata.viewerRole);
        window.clarity('set', 'source', metadata.source);
        window.clarity('set', 'cast_id', metadata.castId);
        if (metadata.candidateId) window.clarity('set', 'candidate_id', metadata.candidateId);
        if (metadata.theme) window.clarity('set', 'theme', metadata.theme);
    }
}

/**
 * Safely fires a Microsoft Clarity Smart Event.
 */
export function trackClaritySmartEvent(eventName: string): void {
    if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
        if (!window.location.pathname.startsWith('/career-identity/')) return;
        try {
            window.clarity('event', eventName);
        } catch {
            // Non-fatal
        }
    }
}

/**
 * Resolves traffic source from query parameters or referrer.
 */
export function resolveTrafficSource(): string {
    if (typeof window === 'undefined') return 'direct';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sourceParam = urlParams.get('source') || urlParams.get('utm_source');
        if (sourceParam) {
            return sourceParam.toLowerCase().trim();
        }

        const referrer = document.referrer;
        if (referrer) {
            const parsed = new URL(referrer);
            const refHost = parsed.hostname.toLowerCase();
            if (refHost.includes('linkedin.com')) return 'linkedin';
            if (refHost.includes('google.com')) return 'google';
            if (refHost.includes('github.com')) return 'github';
            if (refHost.includes('facebook.com') || refHost.includes('fb.com')) return 'facebook';
            if (refHost.includes('twitter.com') || refHost.includes('x.com')) return 'twitter';
            return refHost;
        }
    } catch {
        // Non-fatal
    }

    return 'direct';
}
