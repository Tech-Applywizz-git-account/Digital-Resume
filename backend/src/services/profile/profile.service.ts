import { profileRepository } from '../../repositories/profile.repository.js';

export interface ProfileUpdateInput {
    firstName?: string;
    lastName?: string;
    phone?: string;
    location?: string;
    jobTitle?: string;
    company?: string;
    bio?: string;
}

export class ProfileService {
    async getProfile(userId: string) {
        const profile = await profileRepository.findById(userId);
        if (!profile) {
            throw new Error('Profile not found');
        }
        return profile;
    }

    async updateProfile(userId: string, data: ProfileUpdateInput) {
        const updateData: Record<string, unknown> = {};

        if (data.firstName !== undefined) updateData.first_name = data.firstName;
        if (data.lastName !== undefined) updateData.last_name = data.lastName;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.location !== undefined) updateData.location = data.location;
        if (data.jobTitle !== undefined) updateData.job_title = data.jobTitle;
        if (data.company !== undefined) updateData.company = data.company;
        if (data.bio !== undefined) updateData.bio = data.bio;

        const updated = await profileRepository.update(
            { id: userId } as any,
            updateData
        );

        if (!updated) {
            throw new Error('Failed to update profile');
        }

        return updated;
    }
}

export const profileService = new ProfileService();