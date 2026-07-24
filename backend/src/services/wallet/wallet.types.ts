/**
 * Wallet Types
 * ------------------------------------------------------------------
 * Shared interfaces for the provider-agnostic wallet module.
 * Each wallet provider (NeatPass, native, Tap2, etc.) implements
 * the WalletProvider interface and registers itself in wallet.service.ts.
 */

export interface WalletCardData {
    fullName: string | null;
    jobTitle: string | null;
    headline: string | null;
    location: string | null;
    email: string | null;
    phone: string | null;
    profileImageUrl: string | null;
    careerIdentityUrl: string;
    castId: string;
    company: string | null;
}

export type WalletProviderType = 'native' | 'neatpass' | 'tap2';

export interface WalletProvider {
    /** Unique provider identifier */
    readonly type: WalletProviderType;

    /** Whether this provider requires Apple PassKit signing credentials */
    readonly requiresAppleCredentials: boolean;

    /** Human-readable label for the provider */
    readonly label: string;

    /**
     * Generates a wallet card/pass for the given profile data.
     * Returns a Buffer of the generated file (PNG, .pkpass, etc.).
     */
    generateCard(data: WalletCardData): Promise<Buffer>;

    /**
     * Returns the MIME type for the generated file.
     * Used by the controller for Content-Type header.
     */
    getMimeType(): string;

    /**
     * Returns the file extension for the generated file (without dot).
     * Used by the controller for Content-Disposition filename.
     */
    getFileExtension(): string;

    /**
     * Checks if this provider is available/configured.
     * For native provider, checks if Apple credentials exist.
     * For NeatPass, always returns true (no external dependencies).
     */
    isAvailable(): boolean;

    /**
     * Returns a human-readable error message when provider is unavailable.
     */
    getUnavailableMessage(): string;
}