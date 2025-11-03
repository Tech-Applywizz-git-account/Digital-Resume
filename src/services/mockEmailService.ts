class MockEmailService {
  private sentOTPs: Map<string, string> = new Map();

  async sendOTP(email: string, otp: string): Promise<boolean> {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Store OTP for verification (in real app, this would go to email)
      this.sentOTPs.set(email, otp);
      
      // Log OTP to console for development
      console.log(`📧 OTP for ${email}: ${otp}`);
      console.log(`🔗 Verification link: http://localhost:5173/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`);
      
      // Simulate successful send
      return true;
    } catch (error) {
      console.error('Mock email service error:', error);
      throw new Error('Failed to send OTP');
    }
  }

  getSentOTP(email: string): string | undefined {
    return this.sentOTPs.get(email);
  }
}

export const mockEmailService = new MockEmailService();