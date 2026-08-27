import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface IEmailSender {
  send(to: string, subject: string, text: string): Promise<void>;
}

/**
 * Adapter SMTP dùng cho Notification Worker (TDD Mục 3/12) — TÁCH KHỎI
 * `GmailChannelAdapter` (dùng để TRẢ LỜI khách hàng qua kênh Email).
 * Đây là kênh THÔNG BÁO NỘI BỘ cho Agent/Admin, cấu hình `SMTP_*` riêng
 * (có thể trỏ về cùng tài khoản Gmail App Password, hoặc SMTP khác).
 */
@Injectable()
export class NodemailerEmailSender implements IEmailSender {
  private readonly logger = new Logger(NodemailerEmailSender.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async send(to: string, subject: string, text: string): Promise<void> {
    const host = this.configService.get<string>('notification.smtpHost');
    const user = this.configService.get<string>('notification.smtpUser');
    const pass = this.configService.get<string>('notification.smtpPass');
    const from = this.configService.get<string>('notification.smtpFrom') ?? user;

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASS chưa cấu hình đủ — bỏ qua gửi notification email.',
      );
      return;
    }

    const transporter = this.getTransporter(host, user, pass);
    await transporter.sendMail({ from, to, subject, text });
  }

  private getTransporter(host: string, user: string, pass: string): nodemailer.Transporter {
    if (!this.transporter) {
      const port = this.configService.get<number>('notification.smtpPort', 587);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
    return this.transporter;
  }
}
