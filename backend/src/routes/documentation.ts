import express from 'express';
import { DocumentationGenerator } from '../services/documentationGenerator';
import { DocumentationManager } from '../services/documentationManager';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const docGenerator = new DocumentationGenerator();
const docManager = new DocumentationManager();

/**
 * @route GET /api/documentation
 * @desc Get complete API documentation
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const documentation = await docGenerator.generateDocumentation();
    res.json(documentation);
  } catch (error) {
    console.error('Error generating documentation:', error);
    res.status(500).json({ error: 'Failed to generate documentation' });
  }
});

/**
 * @route GET /api/documentation/sections
 * @desc Get all documentation sections
 * @access Public
 */
router.get('/sections', async (req, res) => {
  try {
    const sections = await docManager.getAllSections();
    res.json(sections);
  } catch (error) {
    console.error('Error fetching documentation sections:', error);
    res.status(500).json({ error: 'Failed to fetch documentation sections' });
  }
});

/**
 * @route GET /api/documentation/sections/:category
 * @desc Get documentation sections by category
 * @access Public
 */
router.get('/sections/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const sections = await docManager.getSectionsByCategory(category as any);
    res.json(sections);
  } catch (error) {
    console.error('Error fetching documentation sections by category:', error);
    res.status(500).json({ error: 'Failed to fetch documentation sections' });
  }
});

/**
 * @route GET /api/documentation/versions
 * @desc Get documentation version history
 * @access Public
 */
router.get('/versions', async (req, res) => {
  try {
    const versions = await docManager.getVersionHistory();
    res.json(versions);
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({ error: 'Failed to fetch version history' });
  }
});

/**
 * @route GET /api/documentation/search
 * @desc Search documentation content
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await docManager.searchDocumentation(query);
    res.json(results);
  } catch (error) {
    console.error('Error searching documentation:', error);
    res.status(500).json({ error: 'Failed to search documentation' });
  }
});

/**
 * @route POST /api/documentation/regenerate
 * @desc Regenerate documentation (admin only)
 * @access Private
 */
router.post('/regenerate', authenticateToken, async (req, res) => {
  try {
    // Check if user has admin privileges (simplified check)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await docManager.regenerateDocumentation();
    res.json({ message: 'Documentation regenerated successfully' });
  } catch (error) {
    console.error('Error regenerating documentation:', error);
    res.status(500).json({ error: 'Failed to regenerate documentation' });
  }
});

/**
 * @route POST /api/documentation/validate
 * @desc Validate documentation consistency
 * @access Private
 */
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validationResults = await docManager.validateDocumentation();
    res.json(validationResults);
  } catch (error) {
    console.error('Error validating documentation:', error);
    res.status(500).json({ error: 'Failed to validate documentation' });
  }
});

/**
 * @route GET /api/documentation/health
 * @desc Check documentation system health
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await docManager.getSystemHealth();
    res.json(health);
  } catch (error) {
    console.error('Error checking documentation health:', error);
    res.status(500).json({ error: 'Failed to check system health' });
  }
});

export default router;