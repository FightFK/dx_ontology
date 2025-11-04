import { Router } from 'express';
import { listRepositories } from '../services/graphdbClient.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const repos = await listRepositories();
    res.json({ ok: true, repos });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
