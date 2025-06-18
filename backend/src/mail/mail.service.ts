/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';

export interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  context?: Record<string, any>;
  html?: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private templatesPath: string;

  constructor(private readonly configService: ConfigService) {
this.templatesPath = path.join(process.cwd(), 'src/mail/templates/email');
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Debug logging for environment variables
    console.log('MAIL_USER:', this.configService.get<string>('MAIL_USER'));
    console.log('MAIL_PASS:', this.configService.get<string>('MAIL_PASS'));
    const smtpConfig = {
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: parseInt(this.configService.get<string>('MAIL_PORT', '587')),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
      tls: {
        rejectUnauthorized: false,
      },
    };

    this.transporter = nodemailer.createTransport(smtpConfig);
    this.logger.log('Mailer transporter initialized');
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      let html = options.html;

      if (options.template && options.context) {
        html = await this.renderTemplate(options.template, options.context);
      }

      const mailOptions = {
        from: this.configService.get<string>('MAIL_FROM', 'Project Manager <no-reply@example.com>'),
        to: options.to,
        subject: options.subject,
        html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${options.to}: ${result.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
    }
  }

  async sendProjectAssignedEmail(to: string, projectName: string, endDate: string): Promise<void> {
    const context = {
      projectName,
      endDate: new Date(endDate).toDateString(),
    };

    const options: EmailOptions = {
      to,
      subject: `New Project Assigned: ${projectName}`,
      template: 'project-assigned', // should exist in /templates/email/project-assigned.ejs
      context,
    };

    await this.sendEmail(options);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const options: EmailOptions = {
      to,
      subject: 'Welcome to Project Manager',
      template: 'welcome-user',
      context: { name },
    };
    await this.sendEmail(options);
  }

  async sendAdminNewUserEmail(adminEmail: string, userName: string, userEmail: string): Promise<void> {
    const options: EmailOptions = {
      to: adminEmail,
      subject: 'New User Registration',
      template: 'admin-new-user',
      context: { userName, userEmail },
    };
    await this.sendEmail(options);
  }

  private async renderTemplate(templateName: string, context: Record<string, any>): Promise<string> {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.ejs`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template "${templateName}" not found at ${templatePath}`);
      }

      const templateOptions = {
        filename: templatePath,
        cache: process.env.NODE_ENV === 'production',
        compileDebug: process.env.NODE_ENV !== 'production',
      };

      const html = await ejs.renderFile(templatePath, context, templateOptions);
      return html;
    } catch (error) {
      this.logger.error(`Template rendering failed: ${error.message}`);
      throw error;
    }
  }
}
