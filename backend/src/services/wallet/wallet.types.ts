/**
 * Shared wallet card fields used by the visual card, Apple Wallet, and Google Wallet.
 */
export interface WalletCardData {
    fullName: string | null;
    jobTitle: string | null;
    headline: string | null;
    location: string | null;
    email: string | null;
    phone: string | null;
    linkedin: string | null;
    profileImageUrl: string | null;
    careerIdentityUrl: string;
    castId: string;
    company: string | null;
    verified?: boolean;
    openToWork?: boolean;
    openToRelocate?: boolean;
    remote?: boolean;
    immediateJoiner?: boolean;
}

export type WalletProviderType = 'native' | 'neatpass' | 'tap2';

export interface WalletProvider {
    readonly type: WalletProviderType;
    readonly requiresAppleCredentials: boolean;
    readonly label: string;
    generateCard(data: WalletCardData): Promise<Buffer>;
    getMimeType(): string;
    getFileExtension(): string;
    isAvailable(): boolean;
    getUnavailableMessage(): string;
}
