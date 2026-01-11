import express from 'express';
import { skillsManager } from '../services/skillsManager';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateSkillTest } from '../utils/validation';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * POST /api/skills/test
 * Create or update a skill test
 */
router.post('/test', async (req: AuthRequest, res) => {
  try {
    const { habitId, month, year, testType, testData } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate input
    const validation = validateSkillTest({ habitId, month, year, testType, testData });
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }

    const skillTest = await skillsManager.createSkillTest(
      userId,
      habitId,
      month,
      year,
      testType,
      testData
    );

    res.status(201).json({
      data: skillTest,
      message: 'Skill test created successfully'
    });
  } catch (error) {
    console.error('Error creating skill test:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/skills/tests
 * Get skill tests for the authenticated user
 */
router.get('/tests', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { habitId, month, year } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const tests = await skillsManager.getSkillTests(
      userId,
      habitId as string,
      month ? parseInt(month as string) : undefined,
      year ? parseInt(year as string) : undefined
    );

    res.json({
      data: tests,
      message: 'Skill tests retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching skill tests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/skills/progress
 * Get skill progress for the authenticated user
 */
router.get('/progress', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { habitId, year } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const progress = await skillsManager.getSkillProgress(
      userId,
      habitId as string,
      year ? parseInt(year as string) : undefined
    );

    res.json({
      data: progress,
      message: 'Skill progress retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching skill progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/skills/template/:habitName
 * Get test template for a specific habit
 */
router.get('/template/:habitName', async (req, res) => {
  try {
    const { habitName } = req.params;
    
    const template = skillsManager.getTestTemplate(habitName);
    
    res.json({
      data: template,
      message: 'Test template retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching test template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/skills/pillar-score/:month/:year
 * Get skills pillar score for Revolut scorecard
 */
router.get('/pillar-score/:month/:year', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { month, year } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const score = await skillsManager.calculateSkillsPillarScore(
      userId,
      parseInt(month),
      parseInt(year)
    );

    res.json({
      data: { score },
      message: 'Skills pillar score calculated successfully'
    });
  } catch (error) {
    console.error('Error calculating skills pillar score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/skills/initialize
 * Initialize default skill levels for the authenticated user
 */
router.post('/initialize', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await skillsManager.initializeDefaultSkillLevels(userId);

    res.json({
      message: 'Default skill levels initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing skill levels:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;