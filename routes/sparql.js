import { Router } from 'express';
import { runSelect, runUpdate } from '../services/graphdbClient.js';

const router = Router();

/**
 * POST /api/sparql/select
 * body: { query: "...SPARQL SELECT..." }
 */
router.post('/select', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const data = await runSelect(query);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/sparql/update
 * body: { update: "...SPARQL UPDATE..." }
 */
router.post('/update', async (req, res) => {
  try {
    const { update } = req.body;
    if (!update) return res.status(400).json({ error: 'update is required' });
    await runUpdate(update);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
