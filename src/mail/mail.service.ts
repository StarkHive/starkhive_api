import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    const from = this.configService.get<string>('SMTP_FROM', 'noreply@starkhive.com');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error) => {
      if (error) {
        console.error('Error with mailer configuration:', error);
      } else {
        console.log('Mailer is ready to send emails');
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"StarkHive" <${this.configService.get<string>('SMTP_FROM', 'noreply@starkhive.com')}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Fallback text content
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  // Helper method to send verification email
  async sendVerificationEmail(email: string, verificationUrl: string): Promise<boolean> {
    const subject = 'Verify your email address';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to StarkHive!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4CAF50; 
                    color: white; 
                    padding: 12px 24px; 
                    text-decoration: none; 
                    border-radius: 4px;
                    font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This email was sent to ${email} because you registered an account on StarkHive.
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }
}
