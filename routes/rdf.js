import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { uploadTurtle } from '../services/graphdbClient.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

/**
 * POST /api/rdf/string
 * body: { turtle: "..." }
 */
router.post('/string', async (req, res) => {
  try {
    const { turtle } = req.body;
    if (!turtle) return res.status(400).json({ error: 'turtle is required' });

    await uploadTurtle(turtle);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/rdf/file
 * form-data: file=@path/to/file.ttl
 */
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    const fpath = req.file?.path;
    if (!fpath) return res.status(400).json({ error: 'file is required' });

    const turtle = fs.readFileSync(fpath, 'utf8');
    await uploadTurtle(turtle);

    // ย้ายไปเก็บสำเนาใน rdf_output/ (optional)
    const out = path.join('rdf_output', `${Date.now()}-${req.file.originalname}`);
    fs.renameSync(fpath, out);

    res.json({ ok: true, saved: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
