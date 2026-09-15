// 邮件发送服务：基于 nodemailer + QQ邮箱 SMTP 发送验证码邮件
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromUser = '';

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('mail.user');
    const authCode = this.configService.get<string>('mail.authCode');

    // 配置缺失时跳过初始化，发送时会抛出友好错误（避免启动崩溃）
    if (!user || !authCode || user.includes('你的') || authCode.includes('你的')) {
      return;
    }
    this.fromUser = user;
    this.transporter = nodemailer.createTransport({
      host: 'smtp.qq.com',
      port: 465,
      secure: true, // 465 端口使用 SSL
      auth: { user, pass: authCode },
    });
  }

  /** 发送验证码邮件 */
  async sendVerifyCode(email: string, code: string, type: 'register' | 'reset' | 'delete') {
    if (!this.transporter) {
      throw new ServiceUnavailableException(
        '邮件服务未配置，请在后端 .env 填写 QQ_MAIL_USER 和 QQ_MAIL_AUTH_CODE',
      );
    }

    const purposeMap = {
      register: '注册账号',
      reset: '找回密码',
      delete: '注销账户',
    } as const;
    const purpose = purposeMap[type];
    await this.transporter.sendMail({
      from: `"JustDoIT" <${this.fromUser}>`,
      to: email,
      subject: `【JustDoIT】${purpose}验证码`,
      html: `
        <div style="max-width:480px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;">
          <h2 style="font-weight:normal;">JustDoIT ${purpose}验证码</h2>
          <p>你的验证码为：</p>
          <p style="font-size:32px;letter-spacing:8px;font-weight:bold;">${code}</p>
          <p style="color:#999;font-size:12px;">验证码 5 分钟内有效，请勿泄露给他人。若非本人操作，请忽略此邮件。</p>
        </div>
      `,
    });
  }
}
