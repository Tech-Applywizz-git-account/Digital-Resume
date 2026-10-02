/**
 * Tap2 Wallet Provider (Stub)
 * ------------------------------------------------------------------
 * Placeholder for future Tap2 integration.
 * Implements WalletProvider interface for forward compatibility.
 *
 * When Tap2 support is ready:
 * 1. Implement generateCard() with Tap2 API calls
 * 2. Update isAvailable() to check Tap2 API credentials
 * 3. Register in wallet.service.ts provider registry
 */
import type { WalletProvider, WalletCardData, WalletProviderType } from '../../wallet.types.js';

class Tap2Provider implements WalletProvider {
    readonly type: WalletProviderType = 'tap2';
    readonly requiresAppleCredentials = false;
    readonly label = 'Tap2';

    getMimeType(): string {
        return 'application/octet-stream';
    }

    getFileExtension(): string {
        return 'tap2';
    }

    isAvailable(): boolean {
        return false; // Not yet implemented
    }

    getUnavailableMessage(): string {
        return 'Tap2 provider is not yet available.';
    }

    async generateCard(_data: WalletCardData): Promise<Buffer> {
        throw new Error('Tap2 provider is not yet implemented.');
    }
}

export const tap2Provider = new Tap2Provider();