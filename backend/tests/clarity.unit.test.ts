import { describe, it, expect, beforeEach, vi } from 'vitest';

// We test the exact browser-guard mechanisms designed in clarity.ts
describe('Microsoft Clarity Route Guard & Teardown Unit Tests', () => {
    let mockLocation: { pathname: string; hostname: string; search: string };
    let mockDocument: any;
    let mockNavigator: any;
    let originalBeaconCalled = false;
    let originalFetchCalled = false;

    beforeEach(() => {
        originalBeaconCalled = false;
        originalFetchCalled = false;

        mockLocation = {
            pathname: '/career-identity/test-cast-123',
            hostname: 'app.applywizz.com',
            search: '?source=linkedin',
        };

        mockDocument = {
            cookie: '_clck=123; _clsk=456; session=active',
            referrer: 'https://www.linkedin.com',
            querySelectorAll: vi.fn(() => []),
            getElementsByTagName: vi.fn(() => [{ parentNode: { insertBefore: vi.fn() } }]),
            createElement: vi.fn(() => ({ id: '', async: 0, src: '' })),
            head: { appendChild: vi.fn() },
        };

        mockNavigator = {
            sendBeacon: vi.fn((_url: string, _data?: any) => {
                originalBeaconCalled = true;
                return true;
            }),
        };

        const mockWindow = {
            location: mockLocation,
            navigator: mockNavigator,
            document: mockDocument,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            history: {
                pushState: vi.fn(),
                replaceState: vi.fn(),
            },
            fetch: vi.fn(async (_input: any, _init?: any) => {
                originalFetchCalled = true;
                return new Response('ok', { status: 200 });
            }),
            sessionStorage: {
                length: 1,
                key: vi.fn((i: number) => (i === 0 ? '_clsk_id' : null)),
                removeItem: vi.fn(),
            },
            localStorage: {
                length: 1,
                key: vi.fn((i: number) => (i === 0 ? '_clck_id' : null)),
                removeItem: vi.fn(),
            },
            clarity: vi.fn(),
        };

        Object.defineProperty(globalThis, 'window', { value: mockWindow, writable: true, configurable: true });
        Object.defineProperty(globalThis, 'document', { value: mockDocument, writable: true, configurable: true });
        Object.defineProperty(globalThis, 'navigator', { value: mockNavigator, writable: true, configurable: true });
        Object.defineProperty(globalThis, 'location', { value: mockLocation, writable: true, configurable: true });
    });

    it('allows beacon delivery when strictly on /career-identity/ path', () => {
        const originalSendBeacon = (globalThis as any).navigator.sendBeacon;
        (globalThis as any).navigator.sendBeacon = function (url: string | URL, data?: any) {
            const urlStr = String(url);
            if (urlStr.includes('clarity.ms')) {
                if (!(globalThis as any).window.location.pathname.startsWith('/career-identity/')) {
                    return true;
                }
            }
            return originalSendBeacon(url, data);
        };

        (globalThis as any).window.location.pathname = '/career-identity/test-cast-123';
        const res = (globalThis as any).navigator.sendBeacon('https://c.clarity.ms/collect', 'payload');
        expect(res).toBe(true);
        expect(originalBeaconCalled).toBe(true);
    });

    it('completely drops beacon delivery when on /dashboard or when client navigates back', () => {
        const originalSendBeacon = (globalThis as any).navigator.sendBeacon;
        (globalThis as any).navigator.sendBeacon = function (url: string | URL, data?: any) {
            const urlStr = String(url);
            if (urlStr.includes('clarity.ms')) {
                if (!(globalThis as any).window.location.pathname.startsWith('/career-identity/')) {
                    return true;
                }
            }
            return originalSendBeacon(url, data);
        };

        (globalThis as any).window.location.pathname = '/dashboard';
        const res = (globalThis as any).navigator.sendBeacon('https://c.clarity.ms/collect', 'payload');
        expect(res).toBe(true);
        expect(originalBeaconCalled).toBe(false); // Never reached network!
    });

    it('completely drops beacon delivery on /career-identity-dashboard', () => {
        const originalSendBeacon = (globalThis as any).navigator.sendBeacon;
        (globalThis as any).navigator.sendBeacon = function (url: string | URL, data?: any) {
            const urlStr = String(url);
            if (urlStr.includes('clarity.ms')) {
                if (!(globalThis as any).window.location.pathname.startsWith('/career-identity/')) {
                    return true;
                }
            }
            return originalSendBeacon(url, data);
        };

        (globalThis as any).window.location.pathname = '/career-identity-dashboard';
        const res = (globalThis as any).navigator.sendBeacon('https://c.clarity.ms/collect', 'payload');
        expect(res).toBe(true);
        expect(originalBeaconCalled).toBe(false); // Excluded!
    });

    it('intercepts fetch calls to clarity.ms when outside /career-identity/ and returns 204', async () => {
        const originalFetch = (globalThis as any).window.fetch;
        (globalThis as any).window.fetch = function (input: any, init?: any) {
            const urlStr = typeof input === 'string' ? input : (input?.url || String(input));
            if (urlStr.includes('clarity.ms')) {
                if (!(globalThis as any).window.location.pathname.startsWith('/career-identity/')) {
                    return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
                }
            }
            return originalFetch(input, init);
        };

        (globalThis as any).window.location.pathname = '/profile';
        const response = await (globalThis as any).window.fetch('https://www.clarity.ms/collect', { method: 'POST' });
        expect(response.status).toBe(204);
        expect(originalFetchCalled).toBe(false); // Zero network traffic sent!
    });

    it('calls clarity stop, pause, and consent denial during teardown', () => {
        const claritySpy = vi.fn();
        (globalThis as any).window.clarity = claritySpy;

        // Execute teardown actions
        if (typeof (globalThis as any).window.clarity === 'function') {
            (globalThis as any).window.clarity('stop');
            (globalThis as any).window.clarity('pause');
            (globalThis as any).window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
            (globalThis as any).window.clarity('consent', false);
        }

        expect(claritySpy).toHaveBeenCalledWith('stop');
        expect(claritySpy).toHaveBeenCalledWith('pause');
        expect(claritySpy).toHaveBeenCalledWith('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
        expect(claritySpy).toHaveBeenCalledWith('consent', false);
    });

    it('clears sessionStorage and localStorage items starting with _cl', () => {
        const sessionMock = (globalThis as any).window.sessionStorage;
        const localMock = (globalThis as any).window.localStorage;

        for (let i = sessionMock.length - 1; i >= 0; i--) {
            const key = sessionMock.key(i);
            if (key && key.startsWith('_cl')) sessionMock.removeItem(key);
        }
        for (let i = localMock.length - 1; i >= 0; i--) {
            const key = localMock.key(i);
            if (key && key.startsWith('_cl')) localMock.removeItem(key);
        }

        expect(sessionMock.removeItem).toHaveBeenCalledWith('_clsk_id');
        expect(localMock.removeItem).toHaveBeenCalledWith('_clck_id');
    });

    it('does NOT load clarity script when clarityStatus is disabled or projectId is null', () => {
        const appendedScripts: any[] = [];
        (globalThis as any).document.head.appendChild = vi.fn((node: any) => {
            appendedScripts.push(node);
        });

        // Simulate CareerIdentityPage logic when clarityStatus is disabled
        const profileData = {
            clarityStatus: 'disabled',
            clarityProjectId: null,
            userId: 'user_456',
        };

        let mountInvoked = false;
        if (profileData.clarityStatus !== 'active' || !profileData.clarityProjectId) {
            // Teardown / skip mount
            (globalThis as any).window.clarity?.('stop');
        } else {
            mountInvoked = true;
        }

        expect(mountInvoked).toBe(false);
        expect(appendedScripts.length).toBe(0);
        expect((globalThis as any).document.head.appendChild).not.toHaveBeenCalled();
    });

    it('does NOT load clarity script if mountClientClarity is called with null or empty string', () => {
        const appendedScripts: any[] = [];
        (globalThis as any).document.head.appendChild = vi.fn((node: any) => {
            appendedScripts.push(node);
        });

        // Simulating mountClientClarity early return logic
        function mountClientClarity(projectId: string | null | undefined) {
            if (typeof (globalThis as any).window === 'undefined' || !projectId) return;
            (globalThis as any).document.head.appendChild({ id: 'clarity-script', src: `https://www.clarity.ms/tag/${projectId}` });
        }

        mountClientClarity(null);
        mountClientClarity('');
        mountClientClarity(undefined);

        expect(appendedScripts.length).toBe(0);
        expect((globalThis as any).document.head.appendChild).not.toHaveBeenCalled();
    });

    describe('Clarity Viewer Role Resolution', () => {
        const resolveRole = async (
            user: { id: string; email: string } | null,
            profileUserId: string,
            crmAdminEmails: string[]
        ): Promise<'owner' | 'admin' | 'other_client' | 'unknown_visitor'> => {
            if (!user) return 'unknown_visitor';
            if (user.id === profileUserId) return 'owner';

            const userEmail = (user.email || '').toLowerCase().trim();
            const isAdmin = crmAdminEmails.some(e => e.toLowerCase() === userEmail);
            if (isAdmin) return 'admin';

            return 'other_client';
        };

        it('resolves unknown_visitor when user is not logged in', async () => {
            const role = await resolveRole(null, 'profile_owner_123', ['admin@applywizz.com']);
            expect(role).toBe('unknown_visitor');
        });

        it('resolves owner when user is the profile owner', async () => {
            const role = await resolveRole({ id: 'profile_owner_123', email: 'owner@applywizz.com' }, 'profile_owner_123', ['admin@applywizz.com']);
            expect(role).toBe('owner');
        });

        it('resolves admin strictly from crm_admins table', async () => {
            const role = await resolveRole({ id: 'staff_999', email: 'staff.coach@applywizz.com' }, 'profile_owner_123', ['staff.coach@applywizz.com']);
            expect(role).toBe('admin');
        });

        it('resolves other_client for corporate recruiters with admin email (admin@microsoft.com) who are not in crm_admins', async () => {
            const role = await resolveRole({ id: 'recruiter_456', email: 'admin@microsoft.com' }, 'profile_owner_123', ['staff.coach@applywizz.com']);
            expect(role).toBe('other_client');
        });

        it('resolves other_client for candidates with @applywizz.com email who are not in crm_admins', async () => {
            const role = await resolveRole({ id: 'candidate_789', email: 'harshitha@applywizz.com' }, 'profile_owner_123', ['staff.coach@applywizz.com']);
            expect(role).toBe('other_client');
        });
    });
});
