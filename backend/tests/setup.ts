import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock Supabase client
vi.mock('../../src/config/database', () => ({
    getDatabase: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn(),
                    single: vi.fn(),
                })),
                in: vi.fn(() => ({
                    maybeSingle: vi.fn(),
                    single: vi.fn(),
                })),
                order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                        range: vi.fn(),
                    })),
                })),
                limit: vi.fn(() => ({
                    range: vi.fn(),
                })),
                range: vi.fn(),
            })),
            insert: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn(),
                })),
            })),
            update: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn(),
                })),
            })),
            delete: vi.fn(),
        })),
        storage: {
            from: vi.fn(() => ({
                getPublicUrl: vi.fn(() => ({
                    data: { publicUrl: 'https://example.com/file.pdf' },
                })),
                upload: vi.fn(() => ({
                    data: { path: 'uploads/file.pdf' },
                    error: null,
                })),
            })),
        },
        auth: {
            getUser: vi.fn(),
        },
    })),
}));

// Global test timeout
beforeAll(() => {
    vi.setConfig({ testTimeout: 10000 });
});

afterEach(() => {
    vi.clearAllMocks();
});

afterAll(() => {
    vi.resetAllMocks();
});