import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { uploadTurtle } from "../services/graphdbClient.js";
import { extractFeaturesFromFile } from "../services/featureExtractor.js";
import { jsonToTurtle } from "../services/rdfMapper.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/file", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).toLowerCase();

    // 1️⃣ ส่งไฟล์ให้ LLM ดึง Feature (เช่น project name, KPI, etc.)
    const featureJSON = await extractFeaturesFromFile(filePath, fileType);

    // 2️⃣ แปลง JSON → Turtle (.ttl)
    const ttl = await jsonToTurtle(featureJSON);

    // 3️⃣ ส่งเข้า GraphDB
    await uploadTurtle(ttl);

    // 4️⃣ ลบไฟล์ temp
    fs.unlinkSync(filePath);

    res.json({ ok: true, message: "Ontology updated", preview: featureJSON });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
