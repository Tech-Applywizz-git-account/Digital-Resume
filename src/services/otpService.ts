// src/services/otpService.ts

interface OTPData {
  email: string;
  otp: string;
  expiresAt: number;
  verified: boolean;
}

class OTPService {
  private otpStorage: Map<string, OTPData> = new Map();

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  storeOTP(email: string, otp: string): void {
  console.log("v4");
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.otpStorage.set(email, { email, otp, expiresAt, verified: false });

    // Auto-delete after expiry
    setTimeout(() => {
      this.otpStorage.delete(email);
    }, 10 * 60 * 1000);
  }

  verifyOTP(email: string, otp: string): boolean {
  console.log("v5");
    const record = this.otpStorage.get(email);
    
  console.log("v6",record);
    if (!record) return false;

    if (Date.now() > record.expiresAt) {
  console.log("v7");
      this.otpStorage.delete(email);
      return false;
    }

    if (record.otp === otp) {
      
  console.log("v8");
      record.verified = true;
      return true;
    }
    return false;
  }

  isOTPVerified(email: string): boolean {
    
  console.log("v9");
    return this.otpStorage.get(email)?.verified || false;
  }

  removeOTP(email: string): void {
    this.otpStorage.delete(email);
  }
}

// ✅ Export both named and default — compatible with all imports
export const otpService = new OTPService();
export default otpService;


