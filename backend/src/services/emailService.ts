import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface FriendInviteEmailData {
  senderName: string;
  senderEmail: string;
  inviteCode: string;
  message?: string;
  appUrl: string;
}

export interface TeamInviteEmailData {
  senderName: string;
  teamName: string;
  inviteCode: string;
  message?: string;
  appUrl: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      // Check if email configuration is available
      const emailConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      };

      // Only configure if all required environment variables are present
      if (emailConfig.host && emailConfig.auth.user && emailConfig.auth.pass) {
        this.transporter = nodemailer.createTransporter(emailConfig);
        this.isConfigured = true;
        console.log('Email service configured successfully');
      } else {
        console.warn('Email service not configured - missing environment variables');
        console.warn('Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
        this.isConfigured = false;
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if email service is properly configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Send friend invitation email
   */
  async sendFriendInvitation(
    recipientEmail: string,
    data: FriendInviteEmailData
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured - skipping email send');
      return false;
    }

    try {
      const template = this.generateFriendInviteTemplate(data);
      
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'KPI Productivity'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Friend invitation email sent:', result.messageId);
      
      // Log email send for tracking
      await this.logEmailSent('friend_invite', recipientEmail, data.senderEmail);
      
      return true;
    } catch (error) {
      console.error('Failed to send friend invitation email:', error);
      return false;
    }
  }

  /**
   * Send team invitation email
   */
  async sendTeamInvitation(
    recipientEmail: string,
    data: TeamInviteEmailData
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured - skipping email send');
      return false;
    }

    try {
      const template = this.generateTeamInviteTemplate(data);
      
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'KPI Productivity'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Team invitation email sent:', result.messageId);
      
      // Log email send for tracking
      await this.logEmailSent('team_invite', recipientEmail, data.senderName);
      
      return true;
    } catch (error) {
      console.error('Failed to send team invitation email:', error);
      return false;
    }
  }

  /**
   * Generate friend invitation email template
   */
  private generateFriendInviteTemplate(data: FriendInviteEmailData): EmailTemplate {
    const { senderName, senderEmail, inviteCode, message, appUrl } = data;
    
    const joinUrl = `${appUrl}/join/friend/${inviteCode}`;
    
    const subject = `${senderName} приглашает вас в KPI Productivity!`;
    
    const text = `
Привет!

${senderName} (${senderEmail}) приглашает вас присоединиться к KPI Productivity - системе отслеживания продуктивности.

${message ? `Сообщение от ${senderName}: "${message}"` : ''}

Чтобы принять приглашение:
1. Перейдите по ссылке: ${joinUrl}
2. Зарегистрируйтесь или войдите в систему
3. Начните отслеживать свою продуктивность вместе!

Или используйте код приглашения: ${inviteCode}

KPI Productivity поможет вам:
- Отслеживать ежедневные привычки
- Ставить и достигать цели
- Соревноваться с друзьями
- Анализировать свой прогресс

Присоединяйтесь к нам: ${appUrl}

С уважением,
Команда KPI Productivity
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Приглашение в KPI Productivity</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .content { background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
        .message { background: #e0f2fe; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0284c7; }
        .invite-code { background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 6px; text-align: center; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; }
        .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
        .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .feature { margin: 10px 0; padding-left: 20px; position: relative; }
        .feature:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 KPI Productivity</h1>
        <p>Приглашение от ${senderName}</p>
    </div>
    
    <div class="content">
        <h2>Привет!</h2>
        <p><strong>${senderName}</strong> (${senderEmail}) приглашает вас присоединиться к <strong>KPI Productivity</strong> - системе отслеживания продуктивности.</p>
        
        ${message ? `<div class="message">
            <strong>Сообщение от ${senderName}:</strong><br>
            "${message}"
        </div>` : ''}
        
        <div class="invite-code">
            Код приглашения: ${inviteCode}
        </div>
        
        <div style="text-align: center;">
            <a href="${joinUrl}" class="button">Принять приглашение</a>
        </div>
        
        <div class="features">
            <h3>KPI Productivity поможет вам:</h3>
            <div class="feature">Отслеживать ежедневные привычки</div>
            <div class="feature">Ставить и достигать цели</div>
            <div class="feature">Соревноваться с друзьями</div>
            <div class="feature">Анализировать свой прогресс</div>
        </div>
        
        <p><strong>Как присоединиться:</strong></p>
        <ol>
            <li>Нажмите кнопку "Принять приглашение" выше</li>
            <li>Зарегистрируйтесь или войдите в систему</li>
            <li>Начните отслеживать свою продуктивность вместе!</li>
        </ol>
    </div>
    
    <div class="footer">
        <p>Если кнопка не работает, скопируйте эту ссылку: <br>
        <a href="${joinUrl}">${joinUrl}</a></p>
        <p>© 2026 KPI Productivity. Все права защищены.</p>
    </div>
</body>
</html>
    `.trim();

    return { subject, text, html };
  }

  /**
   * Generate team invitation email template
   */
  private generateTeamInviteTemplate(data: TeamInviteEmailData): EmailTemplate {
    const { senderName, teamName, inviteCode, message, appUrl } = data;
    
    const joinUrl = `${appUrl}/join/team/${inviteCode}`;
    
    const subject = `Приглашение в команду "${teamName}" от ${senderName}`;
    
    const text = `
Привет!

${senderName} приглашает вас присоединиться к команде "${teamName}" в KPI Productivity!

${message ? `Сообщение от ${senderName}: "${message}"` : ''}

Чтобы присоединиться к команде:
1. Перейдите по ссылке: ${joinUrl}
2. Войдите в систему или зарегистрируйтесь
3. Начните соревноваться с командой!

Или используйте код приглашения: ${inviteCode}

В команде вы сможете:
- Участвовать в общих целях
- Соревноваться в лидерборде
- Мотивировать друг друга
- Отслеживать командный прогресс

Присоединяйтесь: ${appUrl}

С уважением,
Команда KPI Productivity
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Приглашение в команду</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .content { background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
        .team-info { background: #ecfdf5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981; }
        .message { background: #e0f2fe; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0284c7; }
        .invite-code { background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 6px; text-align: center; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
        .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .feature { margin: 10px 0; padding-left: 20px; position: relative; }
        .feature:before { content: "🏆"; position: absolute; left: 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏆 Приглашение в команду</h1>
        <p>KPI Productivity</p>
    </div>
    
    <div class="content">
        <h2>Привет!</h2>
        <p><strong>${senderName}</strong> приглашает вас присоединиться к команде в KPI Productivity!</p>
        
        <div class="team-info">
            <h3>🎯 Команда: "${teamName}"</h3>
            <p>Лидер команды: <strong>${senderName}</strong></p>
        </div>
        
        ${message ? `<div class="message">
            <strong>Сообщение от ${senderName}:</strong><br>
            "${message}"
        </div>` : ''}
        
        <div class="invite-code">
            Код приглашения: ${inviteCode}
        </div>
        
        <div style="text-align: center;">
            <a href="${joinUrl}" class="button">Присоединиться к команде</a>
        </div>
        
        <div class="features">
            <h3>В команде вы сможете:</h3>
            <div class="feature">Участвовать в общих целях</div>
            <div class="feature">Соревноваться в лидерборде</div>
            <div class="feature">Мотивировать друг друга</div>
            <div class="feature">Отслеживать командный прогресс</div>
        </div>
        
        <p><strong>Как присоединиться:</strong></p>
        <ol>
            <li>Нажмите кнопку "Присоединиться к команде" выше</li>
            <li>Войдите в систему или зарегистрируйтесь</li>
            <li>Начните соревноваться с командой!</li>
        </ol>
    </div>
    
    <div class="footer">
        <p>Если кнопка не работает, скопируйте эту ссылку: <br>
        <a href="${joinUrl}">${joinUrl}</a></p>
        <p>© 2026 KPI Productivity. Все права защищены.</p>
    </div>
</body>
</html>
    `.trim();

    return { subject, text, html };
  }

  /**
   * Log email send for tracking purposes
   */
  private async logEmailSent(type: string, recipient: string, sender: string): Promise<void> {
    try {
      // This could be expanded to store in database for tracking
      console.log(`Email sent - Type: ${type}, To: ${recipient}, From: ${sender}, Time: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Failed to log email send:', error);
    }
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('Email service connection test successful');
      return true;
    } catch (error) {
      console.error('Email service connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();