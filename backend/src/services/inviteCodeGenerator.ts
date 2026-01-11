import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class InviteCodeGenerator {
  private static readonly CODE_LENGTH = 8;
  private static readonly CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  private static readonly MAX_ATTEMPTS = 10;

  /**
   * Generate a unique invite code for users
   */
  static async generateUserInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const code = this.generateRandomCode();
      
      // Check if code already exists in users table
      const existingUser = await prisma.user.findUnique({
        where: { inviteCode: code }
      });

      if (!existingUser) {
        return code;
      }
    }

    throw new Error('Failed to generate unique user invite code after maximum attempts');
  }

  /**
   * Generate a unique invite code for teams
   */
  static async generateTeamInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const code = this.generateRandomCode();
      
      // Check if code already exists in teams table
      const existingTeam = await prisma.team.findUnique({
        where: { inviteCode: code }
      });

      if (!existingTeam) {
        return code;
      }
    }

    throw new Error('Failed to generate unique team invite code after maximum attempts');
  }

  /**
   * Generate a unique invite code for friend invitations
   */
  static async generateFriendInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const code = this.generateRandomCode();
      
      // Check if code already exists in friend_invites table
      const existingInvite = await prisma.friendInvite.findUnique({
        where: { inviteCode: code }
      });

      if (!existingInvite) {
        return code;
      }
    }

    throw new Error('Failed to generate unique friend invite code after maximum attempts');
  }

  /**
   * Generate a unique invite code for team invitations
   */
  static async generateTeamInviteCodeForInvites(): Promise<string> {
    for (let attempt = 0; attempt < this.MAX_ATTEMPTS; attempt++) {
      const code = this.generateRandomCode();
      
      // Check if code already exists in team_invites table
      const existingInvite = await prisma.teamInvite.findUnique({
        where: { inviteCode: code }
      });

      if (!existingInvite) {
        return code;
      }
    }

    throw new Error('Failed to generate unique team invite code after maximum attempts');
  }

  /**
   * Generate a random code using crypto for better randomness
   */
  private static generateRandomCode(): string {
    let code = '';
    const bytes = crypto.randomBytes(this.CODE_LENGTH);
    
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += this.CHARACTERS[bytes[i] % this.CHARACTERS.length];
    }
    
    return code;
  }

  /**
   * Validate invite code format
   */
  static validateCodeFormat(code: string): boolean {
    if (!code || typeof code !== 'string') {
      return false;
    }

    // Check length
    if (code.length !== this.CODE_LENGTH) {
      return false;
    }

    // Check characters
    const regex = new RegExp(`^[${this.CHARACTERS}]{${this.CODE_LENGTH}}$`);
    return regex.test(code);
  }

  /**
   * Generate a secure token for email verification
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a short-lived verification code (6 digits)
   */
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}