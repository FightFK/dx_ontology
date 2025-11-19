import fs from "fs";
import pdfParse from "pdf-parse";  
import * as XLSX from "xlsx";
import axios from "axios";
import { getSchemaLoader } from "./ontologyLoader.js";

const LLM_URL = process.env.LLM_URL || "https://llm-uat.105app.site/v1/chat/completions";

/**
 * Simple rule-based extraction (fallback when LLM is unavailable) // ไม่น่าได้ใช้นะ ;-;
 */
function extractWithRules(text) {
  const entities = [];
  const relations = [];
  

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // Simple rules to identify projects and KPIs
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
    // 🔹 Load Ontology Schema
    const schema = await getSchemaLoader();
    const schemaContext = schema.getSchemaContext();
    
    // Build schema description for LLM
    const schemaDescription = `
Available Classes:
${schemaContext.classes.map(c => `- ${c.name}: ${c.comment || c.label}`).join('\n')}

Available Properties:
${schemaContext.objectProperties.map(p => `- ${p.name} (${p.domain} -> ${p.range})`).join('\n')}
${schemaContext.datatypeProperties.map(p => `- ${p.name}: ${p.label}`).join('\n')}

Predefined Individuals:
${schemaContext.individuals.map(i => `- ${i.name} (${i.type}): ${i.label}`).join('\n')}
`;

    // 🔹 เรียก LLM (gpt-oss20b บน vLLM) พร้อม Schema Context
    console.log(`🤖 Calling LLM at ${LLM_URL}...`);
    const res = await axios.post(
      LLM_URL,
      {
        model: "gpt-oss20b",
        messages: [
          {
            role: "system",
            content: `You are a data extraction expert for Digital Transformation (DX) projects. Extract entities and relationships that match the provided ontology schema. You MUST respond ONLY with valid JSON.

${schemaDescription}

IMPORTANT:
1. Only use class types from the schema above
2. Only use properties from the schema above
3. For dimensions, use predefined individuals: Cultural, Strategic, Technological, Operational
4. For phases, use: Planning, Implementation, Evaluation
5. Generate unique IDs in format: {type}_{number} (e.g., project_1, kpi_1)`
          },
          {
            role: "user",
            content: `Extract DX project entities and relationships from this text and return ONLY valid JSON in this exact format:
{
  "entities": [
    {"id": "project_1", "type": "DXProject", "label": "Project Name", "lang": "th"},
    {"id": "budget_1", "type": "Budget", "label": "1000000", "lang": "th"}
  ],
  "relations": [
    {"subject": "project_1", "predicate": "hasBudget", "object": "budget_1"},
    {"subject": "project_1", "predicate": "hasDimension", "object": "Cultural"}
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
    
    // 🔹 Validate against schema
    const validationErrors = [];
    
    if (parsed.entities) {
      parsed.entities.forEach((entity, idx) => {
        const validation = schema.validateEntity(entity);
        if (!validation.valid) {
          console.warn(`⚠️  Entity ${idx} validation failed:`, validation.errors);
          validationErrors.push(...validation.errors);
        }
      });
    }
    
    if (parsed.relations) {
      parsed.relations.forEach((relation, idx) => {
        const validation = schema.validateRelation(relation);
        if (!validation.valid) {
          console.warn(`⚠️  Relation ${idx} validation failed:`, validation.errors);
          validationErrors.push(...validation.errors);
        }
      });
    }
    
    if (validationErrors.length > 0) {
      console.warn(`⚠️  Found ${validationErrors.length} validation warnings`);
    } else {
      console.log('✅ All entities and relations validated successfully');
    }
    
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


