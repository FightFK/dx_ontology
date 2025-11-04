import fs from "fs";
import pdfParse from "pdf-parse";  
import * as XLSX from "xlsx";
import axios from "axios";

const LLM_URL = process.env.LLM_URL || "https://llm-uat.105app.site/v1/chat/completions";

/**
 * Simple rule-based extraction (fallback when LLM is unavailable)
 */
function extractWithRules(text) {
  const entities = [];
  const relations = [];
  
  // หาคำสำคัญพื้นฐาน
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // ตัวอย่างง่ายๆ: หา project name, KPI, target
    if (trimmed.toLowerCase().includes('project') || trimmed.toLowerCase().includes('โครงการ')) {
      entities.push({
        id: `project_${idx}`,
        type: "Project",
        label: trimmed.substring(0, 100),
        lang: "th"
      });
    }
    
    if (trimmed.match(/\d+%/) || trimmed.toLowerCase().includes('kpi')) {
      entities.push({
        id: `kpi_${idx}`,
        type: "KPI",
        label: trimmed.substring(0, 100),
        lang: "th"
      });
    }
  });
  
  return { entities, relations };
}

export async function extractFeaturesFromFile(filePath, fileType) {
  let text = "";

  console.log(`📂 Processing file: ${filePath}`);
  console.log(`📋 File type: ${fileType}`);

  try {
    if (fileType === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      console.log(`📦 PDF buffer size: ${dataBuffer.length} bytes`);
      
      const pdf = await pdfParse(dataBuffer); 
      text = pdf.text || "";
      
      console.log(`📄 PDF info: ${pdf.numpages} pages`);
      console.log(`📝 First 200 chars: ${text.substring(0, 200)}`);
      
    } else if (fileType === ".xls" || fileType === ".xlsx") {
      const workbook = XLSX.readFile(filePath);
      console.log(`📊 Excel sheets: ${workbook.SheetNames.join(', ')}`);
      
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      text = XLSX.utils.sheet_to_csv(sheet);
      
      console.log(`📝 First 200 chars: ${text.substring(0, 200)}`);
      
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    throw error;
  }

  console.log(`📄 Extracted text length: ${text.length} characters`);

  // ถ้า text สั้นเกินไป แสดง warning
  if (text.trim().length < 10) {
    console.warn(`⚠️  WARNING: Extracted text is too short (${text.length} chars)`);
    console.warn(`⚠️  Text content: "${text}"`);
  }

  // ถ้าไม่มี API key หรือ text ว่างเปล่า ใช้ rule-based
  if (!process.env.API_KEY || text.trim().length === 0) {
    console.log("⚠️  Using rule-based extraction (no API key or empty text)");
    return extractWithRules(text);
  }

  try {
    // 🔹 เรียก LLM (gpt-oss20b บน vLLM)
    console.log(`🤖 Calling LLM at ${LLM_URL}...`);
    const res = await axios.post(
      LLM_URL,
      {
        model: "gpt-oss20b",
        messages: [
          {
            role: "system",
            content: "You are a data extraction expert. You MUST respond ONLY with valid JSON. Do not include any explanations or text outside the JSON structure."
          },
          {
            role: "user",
            content: `Extract entities and relationships from the following text and return ONLY valid JSON in this exact format:
{
  "entities": [
    {"id": "unique_id", "type": "EntityType", "label": "Entity Name", "lang": "en"}
  ],
  "relations": [
    {"subject": "entity_id_1", "predicate": "relationType", "object": "entity_id_2"}
  ]
}

Text to analyze:
${text.substring(0, 4000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    // Parse LLM response
    const content = res.data.choices?.[0]?.message?.content || "{}";
    console.log("✅ LLM Raw Response:", content.substring(0, 200) + "...");
    
    // ลอง parse JSON ถ้ามี markdown code block
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }
    
    const parsed = JSON.parse(jsonStr);
    console.log(`✅ Parsed ${parsed.entities?.length || 0} entities, ${parsed.relations?.length || 0} relations`);
    return parsed;
    
  } catch (e) {
    console.error("❌ LLM Error:", e.message);
    if (e.response) {
      console.error("Response status:", e.response.status);
      console.error("Response data:", e.response.data);
    }
    
    // Fallback to rule-based extraction
    console.log("⚠️  Falling back to rule-based extraction");
    return extractWithRules(text);
  }
}


