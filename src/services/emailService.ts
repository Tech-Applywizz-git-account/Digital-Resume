class EmailService {
  async sendOTP(email: string, otp: string): Promise<boolean> {
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Check if we're in development mode with a visible OTP
        if (data.developmentOtp) {
          console.log(`📧 Development OTP for ${email}: ${data.developmentOtp}`);
        }
        return true;
      } else {
        // If email fails, log OTP for development
        console.log(`📧 OTP for ${email}: ${otp}`);
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error) {
      // Fallback - log OTP for development
      console.log(`📧 OTP for ${email}: ${otp}`);
      throw new Error('Failed to send OTP. Check console for OTP code.');
    }
  }
}

export const emailService = new EmailService();