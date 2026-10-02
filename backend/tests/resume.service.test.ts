import { describe, it, expect, vi } from 'vitest';
import { resumeService } from '../src/services/resume/resume.service.js';

describe('ResumeService', () => {
    it('should throw NotFoundError when resume does not exist', async () => {
        vi.mock('../src/repositories/crmJobRequest.repository', () => ({
            crmJobRequestRepository: { findOne: vi.fn(() => null) },
        }));
        vi.mock('../src/repositories/jobRequest.repository', () => ({
            jobRequestRepository: { findOne: vi.fn(() => null) },
        }));

        await expect(resumeService.resolveFullResume('nonexistent')).rejects.toThrow('Resume');
    });
});