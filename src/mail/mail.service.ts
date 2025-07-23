import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

export interface EmailOptions {
  to: string;
  subject: string;
  template: string; // template filename
  context: Record<string, any>; // data for template
  text?: string;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const host = this.configService.get<string>('SMTP_HOST');
      const port = this.configService.get<number>('SMTP_PORT');
      const secure = this.configService.get<boolean>('SMTP_SECURE', false);
      const user = this.configService.get<string>('SMTP_USER');
      const pass = this.configService.get<string>('SMTP_PASSWORD');

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
    } catch (error) {
      console.error('Failed to initialize mail transporter:', error);
      // Set a null transporter to prevent crashes
      this.transporter = null;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        console.warn('Mail transporter not initialized, skipping email send');
        return false;
      }

      const html = this.renderTemplate(options.template, options.context);
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"StarkHive" <${this.configService.get<string>('SMTP_FROM', 'noreply@starkhive.com')}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || html.replace(/<[^>]*>/g, ''), // Fallback text content
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Message sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  private renderTemplate(
    templateName: string,
    context: Record<string, any>,
  ): string {
    try {
      const templatePath = path.join(
        __dirname,
        '..',
        'templates',
        `${templateName}.hbs`,
      );
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateSource);
      return template(context);
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      return `<p>Error rendering email template</p>`;
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationUrl: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      template: 'verification',
      context: {
        name,
        verificationUrl,
      },
    });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetUrl: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Reset your password',
      template: 'password-reset',
      context: {
        name,
        resetUrl,
      },
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Welcome to StarkHive!',
      template: 'welcome',
      context: {
        name,
      },
    });
  }

  async sendJobApplicationEmail(
    email: string,
    applicantName: string,
    jobTitle: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: `New application for ${jobTitle}`,
      template: 'job-application',
      context: {
        applicantName,
        jobTitle,
      },
    });
  }

  async sendCustomEmail(
    email: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject,
      template: '', // Not using template for verification
      context: {},
      text: html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    } as any);
  }
}
