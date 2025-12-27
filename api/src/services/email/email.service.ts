import { Resend } from 'resend';

export interface ContactSubmissionData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private adminEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY || 'test';
    this.resend = new Resend(apiKey);
    this.fromEmail = process.env.EMAIL_FROM || 'ScreenCraft <noreply@screencraft.dev>';
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@screencraft.dev';
  }

  /**
   * Send newsletter confirmation email with double opt-in link
   */
  async sendNewsletterConfirmation(email: string, confirmUrl: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Confirm your ScreenCraft Newsletter subscription',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirm Your Subscription</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ScreenCraft!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="margin-top: 0;">Thank you for your interest in ScreenCraft. Please confirm your email address to start receiving our newsletter.</p>
              <p>By confirming, you'll receive:</p>
              <ul style="padding-left: 20px;">
                <li>Product updates and new features</li>
                <li>Tips for better screenshot automation</li>
                <li>Exclusive early access to new tools</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Confirm Subscription</a>
              </div>
              <p style="color: #666; font-size: 14px;">If you didn't subscribe to our newsletter, you can safely ignore this email.</p>
              <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; margin-bottom: 0;">ScreenCraft - Professional Screenshot & PDF Generation API</p>
            </div>
          </body>
          </html>
        `,
      });
    } catch (error) {
      console.error('Failed to send newsletter confirmation email:', error);
      throw new Error('Failed to send confirmation email');
    }
  }

  /**
   * Send welcome email after newsletter confirmation
   */
  async sendNewsletterWelcome(email: string, unsubscribeUrl: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Welcome to ScreenCraft Newsletter!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome!</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">You're In!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="margin-top: 0; font-size: 18px;">Thanks for confirming your subscription to the ScreenCraft newsletter!</p>
              <p>You're now part of our community. Here's what you can expect:</p>
              <ul style="padding-left: 20px;">
                <li><strong>Weekly updates</strong> on new features and improvements</li>
                <li><strong>Tips & tricks</strong> for maximizing your API usage</li>
                <li><strong>Early access</strong> to beta features</li>
                <li><strong>Exclusive offers</strong> for newsletter subscribers</li>
              </ul>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold;">Get Started:</p>
                <p style="margin: 10px 0 0 0;">Check out our <a href="https://screencraft.dev/docs" style="color: #667eea;">documentation</a> to learn how to generate your first screenshot!</p>
              </div>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">If you ever want to unsubscribe, click <a href="${unsubscribeUrl}" style="color: #999;">here</a>.</p>
              <p style="color: #999; font-size: 12px; margin-bottom: 0;">ScreenCraft - Professional Screenshot & PDF Generation API</p>
            </div>
          </body>
          </html>
        `,
      });
    } catch (error) {
      console.error('Failed to send newsletter welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  /**
   * Send auto-reply for contact form submissions
   */
  async sendContactAutoReply(email: string, name: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'We received your message - ScreenCraft',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Message Received</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Message Received</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="margin-top: 0;">Hi ${this.escapeHtml(name)},</p>
              <p>Thank you for reaching out to us! We've received your message and a member of our team will get back to you within 24-48 hours.</p>
              <p>In the meantime, you might find these resources helpful:</p>
              <ul style="padding-left: 20px;">
                <li><a href="https://screencraft.dev/docs" style="color: #667eea;">API Documentation</a></li>
                <li><a href="https://screencraft.dev/faq" style="color: #667eea;">Frequently Asked Questions</a></li>
                <li><a href="https://screencraft.dev/status" style="color: #667eea;">Service Status</a></li>
              </ul>
              <p>Best regards,<br>The ScreenCraft Team</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
              <p style="color: #999; font-size: 12px; margin-bottom: 0;">This is an automated response. Please do not reply to this email.</p>
            </div>
          </body>
          </html>
        `,
      });
    } catch (error) {
      console.error('Failed to send contact auto-reply:', error);
      throw new Error('Failed to send auto-reply email');
    }
  }

  /**
   * Send notification to admin about new contact form submission
   */
  async sendContactNotification(submission: ContactSubmissionData): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: this.adminEmail,
        subject: `[Contact Form] ${submission.subject} from ${submission.name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Contact Form Submission</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2d3748; padding: 20px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">New Contact Form Submission</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold; width: 100px;">Name:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">${this.escapeHtml(submission.name)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold;">Email:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;"><a href="mailto:${this.escapeHtml(submission.email)}" style="color: #667eea;">${this.escapeHtml(submission.email)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold;">Subject:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">${this.escapeHtml(submission.subject)}</td>
                </tr>
              </table>
              <div style="margin-top: 20px;">
                <p style="font-weight: bold; margin-bottom: 10px;">Message:</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; white-space: pre-wrap;">${this.escapeHtml(submission.message)}</div>
              </div>
              <div style="margin-top: 20px; text-align: center;">
                <a href="mailto:${this.escapeHtml(submission.email)}?subject=Re: ${encodeURIComponent(submission.subject)}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Reply to ${this.escapeHtml(submission.name)}</a>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (error) {
      console.error('Failed to send contact notification:', error);
      throw new Error('Failed to send notification email');
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
  }
}

// Export singleton instance
export const emailService = new EmailService();
