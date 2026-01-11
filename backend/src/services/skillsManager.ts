/**
 * Skills Manager Service - Temporarily Disabled
 * TODO: Fix Prisma client generation for skillTest and skillProgress models
 */

export class SkillsManager {
  async createSkillTest(
    userId: string,
    habitId: string,
    month: number,
    year: number,
    testType: string,
    testData: any
  ): Promise<any> {
    throw new Error('Skills functionality temporarily disabled - Prisma client needs regeneration');
  }

  async getSkillTests(
    userId: string,
    habitId?: string,
    month?: number,
    year?: number
  ): Promise<any[]> {
    // Return empty array for now - skills functionality is being rebuilt
    return [];
  }

  async calculateSkillProgress(userId: string, habitId: string, month: number, year: number): Promise<any> {
    throw new Error('Skills functionality temporarily disabled - Prisma client needs regeneration');
  }

  async getSkillProgress(
    userId: string,
    habitId?: string,
    year?: number
  ): Promise<any[]> {
    // Return empty array for now - skills functionality is being rebuilt
    return [];
  }

  getTestTemplate(habitName: string): any {
    // Return basic template structure
    return {
      habitName,
      testType: 'monthly',
      fields: [],
      instructions: 'Skills testing is currently being rebuilt'
    };
  }

  async calculateSkillsPillarScore(userId: string, month: number, year: number): Promise<number> {
    // Return default score for now
    return 75;
  }

  async initializeDefaultSkillLevels(userId: string): Promise<void> {
    throw new Error('Skills functionality temporarily disabled - Prisma client needs regeneration');
  }
}

// Export singleton instance
export const skillsManager = new SkillsManager();