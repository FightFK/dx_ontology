import { Router } from 'express';
import { generateSPARQL, answerQuestion } from '../services/queryGenerator.js';

const router = Router();

/**
 * POST /api/query/ask
 * Natural language question answering
 * 
 * Body: { question: "โครงการไหนบ้างที่มี budget เกิน 1 ล้าน?" }
 * 
 * Response: {
 *   question: "...",
 *   sparql: "SELECT ...",
 *   results: [...],
 *   answer: "พบ 3 โครงการที่มี budget เกิน 1 ล้าน ได้แก่..."
 * }
 */
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }
    
    console.log(`\n📝 Question: ${question}`);
    
    const result = await answerQuestion(question);
    
    res.json({
      ok: true,
      ...result
    });
    
  } catch (e) {
    console.error('❌ Query error:', e);
    res.status(500).json({ 
      ok: false,
      error: e.message 
    });
  }
});

/**
 * POST /api/query/sparql
 * Generate SPARQL from natural language (without executing)
 * 
 * Body: { question: "..." }
 * Response: { sparql: "SELECT ..." }
 */
router.post('/sparql', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }
    
    const sparql = await generateSPARQL(question);
    
    res.json({
      ok: true,
      question,
      sparql
    });
    
  } catch (e) {
    console.error('❌ SPARQL generation error:', e);
    res.status(500).json({ 
      ok: false,
      error: e.message 
    });
  }
});

export default router;
