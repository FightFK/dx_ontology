import fs from "fs";
import pdfParse from "pdf-parse";
import XLSX from "xlsx";
import mammoth from "mammoth";
import axios from "axios";
import { getSchemaLoader } from "./ontologyLoader.js";

const LLM_URL =
  process.env.LLM_URL || "https://openrouter.ai/api/v1/chat/completions";
const LLM_MODEL = process.env.LLM_MODEL || "google/gemini-2.0-flash-exp:free";

// 🔹 Ontology Class Descriptions
const CLASS_DESCRIPTIONS = {
  DigitalProvider:
    "Organizations, companies, or service providers that deliver digital solutions, platforms, or technologies (software, hardware, cloud services, consultation)",

  DXDimension:
    "Various dimensions that must be considered when implementing a DX project. Each dimension reflects a critical factor for success.",
  Cultural:
    "(DXDimension subclass) Values and behaviors that support technology acceptance and adoption",
  Environmental:
    "(DXDimension subclass) External factors like policies, trends, and resources that influence digital adoption",
  Financial:
    "(DXDimension subclass) Budgeting, cost management, and measuring ROI in digital transformation",
  Informational:
    "(DXDimension subclass) Managing data to support decision-making with accuracy, security, and accessibility",
  Innovation:
    "(DXDimension subclass) New technologies and digital solutions like AI and automation to improve performance",
  Participative:
    "(DXDimension subclass) Collaboration, user feedback, and stakeholder involvement in digital change",
  Quality:
    "(DXDimension subclass) Improving efficiency, user experience, and compliance through digital tools",
  Security:
    "(DXDimension subclass) IT, data, and human security to protect digital assets from threats",
  Structural:
    "(DXDimension subclass) How an organization adapts its structure, processes, and workforce to support digital change",

  DXPhase:
    "Key phases of Digital Transformation project - progression from digitization to digitalization to transformation",
  Digitization:
    "(DXPhase subclass) Converting analog/physical data into digital form (e.g., scanning documents, electronic files). Changes data format but not business processes",
  Digitalization:
    "(DXPhase subclass) Applying digital technologies to improve existing business processes through automation and system integration (e.g., cloud accounting, CRM, supply chain automation)",
  DigitalTransformation:
    "(DXPhase subclass) Most advanced phase where digital technologies fundamentally reshape organizational models, operations, and customer interactions (e.g., AI-driven decisions, digital service delivery, blockchain)",

  DXProject:
    "Core entity representing a Digital Transformation project, linking together components, processes, and stakeholders",
  PostProject:
    "Completed DX project with evaluation, knowledge capturing, sustainability planning, and long-term impact assessment",
  PreProject:
    "Pre-implementation phase of DX project capturing planning and preparation activities",

  DxResourceType:
    "Types of resources used in DX project: PDF, Word, Excel, images, videos, etc.",

  KPI: "Key Performance Indicators to measure and evaluate project success or progress based on predefined targets",

  ProjectDetail:
    "Operational and contextual information: organization, budget, location",
  Budget: "(ProjectDetail subclass) Financial allocation for the DX project",
  Location:
    "(ProjectDetail subclass) Geographic or administrative area where project is implemented",
  Organization:
    "(ProjectDetail subclass) Entity responsible for initiating, managing, or supporting the project (government, company, institution)",

  ResultProject: "Outcomes and achieved results of a DX project",

  TechCategory:
    "Category or domain of technologies: agriculture, tourism, healthcare, etc.",

  TechProduct:
    "Specific digital tools, platforms, or systems: software applications, data platforms, cloud services",
};

export async function extractFeaturesFromFile(filePath, fileType) {
  let text = "";

  console.log(`📂 Processing file: ${filePath}`);
  console.log(`📋 File type: ${fileType}`);

  try {
    if (fileType === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      console.log(`📦 PDF buffer size: ${dataBuffer.length} bytes`);

      try {
        const pdf = await pdfParse(dataBuffer);
        text = pdf.text || "";

        console.log(`📄 PDF info: ${pdf.numpages} pages`);
        console.log(`📝 First 500 chars: ${text.substring(0, 500)}`);
      } catch (pdfError) {
        console.error(`❌ PDF parsing error: ${pdfError.message}`);

        if (
          pdfError.message.includes("XRef") ||
          pdfError.message.includes("bad XRef entry")
        ) {
          throw new Error(
            "ไฟล์ PDF นี้มีปัญหา (corrupted หรือ encrypted). กรุณาลอง:\n1. เปิดไฟล์ด้วย PDF reader แล้ว Export/Save As ใหม่\n2. ใช้ online PDF repair tool\n3. แปลงเป็น image แล้วใช้ OCR"
          );
        } else if (
          pdfError.message.includes("encrypted") ||
          pdfError.message.includes("password")
        ) {
          throw new Error(
            "ไฟล์ PDF นี้ถูกป้องกันด้วยรหัสผ่าน กรุณาปลดล็อคก่อนอัพโหลด"
          );
        } else {
          throw new Error(`ไม่สามารถอ่านไฟล์ PDF ได้: ${pdfError.message}`);
        }
      }
    } else if (
      fileType === ".xls" ||
      fileType === ".xlsx" ||
      fileType === ".csv"
    ) {
      try {
        const workbook = XLSX.readFile(filePath);
        console.log(`📊 Excel sheets: ${workbook.SheetNames.join(", ")}`);

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        console.log(`📊 Found ${jsonData.length} rows`);

        // 🔹 Format as structured text for better LLM understanding
        if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0]);
          console.log(`📋 Headers: ${headers.join(", ")}`);

          // Create readable text with clear structure
          text = `=== Excel/CSV Data ===\n\n`;
          text += `Headers: ${headers.join(" | ")}\n\n`;
          text += `--- Data Rows ---\n\n`;

          jsonData.forEach((row, idx) => {
            text += `Row ${idx + 1}:\n`;
            headers.forEach((header) => {
              const value = row[header];
              if (value !== null && value !== undefined && value !== "") {
                text += `  ${header}: ${value}\n`;
              }
            });
            text += `\n`;
          });
        } else {
          // Fallback to CSV format if no data
          text = XLSX.utils.sheet_to_csv(sheet);
        }

        console.log(`📝 First 400 chars:\n${text.substring(0, 400)}`);
      } catch (xlsxError) {
        console.error(`❌ Excel parsing error: ${xlsxError.message}`);
        throw new Error(`ไม่สามารถอ่านไฟล์ Excel ได้: ${xlsxError.message}`);
      }

      try {
        const workbook = XLSX.readFile(filePath);
        console.log(`📊 Excel sheets: ${workbook.SheetNames.join(", ")}`);

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(sheet);

        console.log(`📝 First 200 chars: ${text.substring(0, 200)}`);
      } catch (xlsxError) {
        console.error(`❌ Excel parsing error: ${xlsxError.message}`);
        throw new Error(`ไม่สามารถอ่านไฟล์ Excel ได้: ${xlsxError.message}`);
      }
    } else if (fileType === ".docx") {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        console.log(`📦 DOCX buffer size: ${dataBuffer.length} bytes`);

        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        text = result.value || "";

        if (result.messages && result.messages.length > 0) {
          console.log(`⚠️ DOCX warnings: ${result.messages.length}`);
        }

        console.log(`📝 First 200 chars: ${text.substring(0, 200)}`);
      } catch (docxError) {
        console.error(`❌ DOCX parsing error: ${docxError.message}`);
        throw new Error(`ไม่สามารถอ่านไฟล์ DOCX ได้: ${docxError.message}`);
      }
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    throw error;
  }

  console.log(`📄 Extracted text length: ${text.length} characters`);

  if (text.trim().length < 10) {
    console.warn(
      `⚠️  WARNING: Extracted text is too short (${text.length} chars)`
    );
    console.warn(`⚠️  Text content: "${text}"`);
  }

  try {
    // 🔹 Load Ontology Schema
    const schema = await getSchemaLoader();
    const schemaContext = schema.getSchemaContext();

    // Generate timestamp for unique IDs across multiple ingestions
    const timestamp = Date.now();
    console.log(`🔖 Using timestamp for IDs: ${timestamp}`);

    // Build detailed class descriptions
    const classDescriptions = schemaContext.classes
      .map((c) => {
        const desc =
          CLASS_DESCRIPTIONS[c.name] || c.comment || c.label || "DX class";
        return `• ${c.name}: ${desc}`;
      })
      .join("\n");

    // Create lists for validation
    const allowedClasses = schemaContext.classes.map((c) => c.name).join(", ");
    const allowedObjectProps = schemaContext.objectProperties
      .map((p) => p.name)
      .join(", ");
    const allowedDatatypeProps = schemaContext.datatypeProperties
      .map((p) => p.name)
      .join(", ");
    const allowedIndividuals = schemaContext.individuals
      .map((i) => i.name)
      .join(", ");

    // 🔹 Call LLM with comprehensive schema context
    console.log(`🤖 Calling LLM (${LLM_MODEL}) at ${LLM_URL}...`);
    const res = await axios.post(
      LLM_URL,
      {
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a Digital Transformation (DX) expert specializing in knowledge extraction.

=== DX ONTOLOGY KNOWLEDGE BASE ===

CLASS DEFINITIONS (with detailed descriptions):
${classDescriptions}

ALLOWED OBJECT PROPERTIES:
${allowedObjectProps}

ALLOWED DATATYPE PROPERTIES:
${allowedDatatypeProps}

PREDEFINED INDIVIDUALS (exact names only):
${allowedIndividuals}

=== EXTRACTION RULES ===

1. **Class Selection Guide**:
   
   a) **Projects**:
      - DXProject (general active project)
      - PostProject (completed with results)
      - PreProject (planning/proposal phase)
   
   b) **Stakeholders & Organizations** (CRITICAL - DO NOT SKIP):
      - Extract ALL mentioned organizations, municipalities, vendors, agencies
      - Class: Organization
      - Examples: "Kho Hong Municipality" → organization_1, "depa Southern Branch" → organization_2
      - Link: dxproject_1 → hasProjectDetail → organization_X
   
   c) **Technologies** (CRITICAL - DISTINGUISH CAREFULLY):
      - TechProduct: Actual systems/software (Cloud CRM, Voice Bot, Mobile App, AI Chatbot, Dashboard)
      - TechCategory: Domain/sector (Tourism, Healthcare, Agriculture, Government Services)
      - Innovation: Abstract concepts/methodologies (AI adoption, Process automation, Digital mindset)
      - Link: dxproject_1 → hasTechProduct → techproduct_X
   
   d) **Project Phase** (MANDATORY - ALWAYS ASSIGN):
      - Digitization: Converting paper to digital (scanning, digitizing records)
      - Digitalization: Process automation (CRM, workflow systems, integration)
      - DigitalTransformation: Fundamental change (AI-driven, blockchain, platform economy)
      - Link: dxproject_1 → hasPhase → digitalization_1
   
   e) **Dimensions** (Extract from challenges, focus areas, considerations):
      - Cultural: User adoption, resistance, mindset
      - Environmental: Policies, regulations, external trends
      - Financial: Budget constraints, ROI, cost management
      - Informational: Data silos, data quality, analytics
      - Innovation: New tech adoption, R&D
      - Participative: Stakeholder involvement, collaboration
      - Quality: Service quality, efficiency, UX
      - Security: Cybersecurity, data protection
      - Structural: Org structure, process redesign
      - Link: dxproject_1 → hasDimension → cultural_1
   
   f) **Results & Outcomes** (CRITICAL - EXTRACT ALL METRICS):
      - Class: ResultProject
      - Extract ALL quantitative results, KPIs achieved, improvements
      - Examples: "+18% satisfaction" → resultproject_1, "-22% AHT" → resultproject_2
      - Link: dxproject_1 → hasProjectResult → resultproject_X
   
   g) **KPIs** (Different from Results - these are targets/metrics being tracked):
      - Class: KPI
      - Properties: kpiName, kpiValue, targetValue
      - Link: dxproject_1 → hasKPI → kpi_X
   
   h) **Budget & Location**:
      - Budget: Financial allocation (properties: budgetAmount)
      - Location: Geographic area (properties: locationName)
      - Link: dxproject_1 → hasProjectDetail → budget_1/location_1
   
   i) **Digital Providers** (Vendors/Service Providers):
      - Class: DigitalProvider
      - Extract companies providing tech solutions
      - Link: dxproject_1 → hasDigitalProvider → digitalprovider_X

2. **URL Links & Resources** (IMPORTANT):
   - Detect and preserve URLs from text:
     * Google Drive links (https://drive.google.com/...)
     * Website URLs (https://...)
     * Image references (รูปภาพ:, ภาพ:, Image:, Photo:)
   - Store in projectDescription property with clear markers
   - Format: "Project description text | Images: [URL1], [URL2]"
   - Examples:
     * "Smart Tourism project | Images: https://drive.google.com/file/d/abc123/view"
     * "Digital healthcare system | Website: https://hospital.go.th | Photos: https://drive.google.com/..."

3. **Property Usage**: 
   - Use EXACT property names from allowed lists
   - Common relations:
     * hasProjectDetail (→ Budget, Location, Organization)
     * hasDimension (→ Cultural, Environmental, Financial, etc.)
     * hasPhase (→ Digitization, Digitalization, DigitalTransformation)
     * hasKPI (→ KPI)
     * hasProjectResult (→ ResultProject)
     * hasTechProduct (→ TechProduct)
     * hasTechCategory (→ TechCategory)
     * hasDigitalProvider (→ DigitalProvider)
   - Datatype properties for text with URLs:
     * projectDescription: Can contain text + URLs (e.g., "Description | Images: URL")

4. **ID Generation**: 
   - Format: {lowercase_type}_{timestamp}_{sequential_number}
   - The timestamp will be provided in the user message
   - Examples: organization_1734123456_1, techproduct_1734123456_1, resultproject_1734123456_1

5. **Language Tag**:
   - "lang": "th" for Thai content
   - "lang": "en" for English content

6. **Completeness Checklist** (Extract ALL of these if mentioned):
   ✅ Projects (DXProject/PreProject/PostProject)
   ✅ Organizations (ALL stakeholders, municipalities, agencies)
   ✅ Technologies (TechProduct for actual systems, TechCategory for domains)
   ✅ Phase (ALWAYS assign: Digitization/Digitalization/DigitalTransformation)
   ✅ Dimensions (Cultural, Environmental, Financial, Informational, etc.)
   ✅ Results (ALL metrics, improvements, outcomes)
   ✅ KPIs (targets being measured)
   ✅ Budget (if amount mentioned)
   ✅ Location (if place mentioned)
   ✅ Digital Providers (vendors)

COMPREHENSIVE EXAMPLE:
Text: "Kho Hong Municipality partnered with depa Southern Branch to deploy Cloud CRM system (budget 1M baht) in Satun province. The digitalization project improved citizen satisfaction by 18% and reduced response time by 30%. Main challenge was user resistance to new technology. รูปภาพโครงการ: https://drive.google.com/file/d/abc123xyz/view?usp=sharing"

Timestamp: 1734123456

Extract:
{
  "entities": [
    {"id": "dxproject_1734123456_1", "type": "DXProject", "label": "Kho Hong Cloud CRM", "lang": "en", "properties": {
      "projectName": "Kho Hong Cloud CRM",
      "projectDescription": "Cloud CRM deployment for citizen services | Images: https://drive.google.com/file/d/abc123xyz/view?usp=sharing"
    }},
    {"id": "organization_1734123456_1", "type": "Organization", "label": "Kho Hong Municipality", "lang": "en", "properties": {"organizationName": "Kho Hong Municipality"}},
    {"id": "organization_1734123456_2", "type": "Organization", "label": "depa Southern Branch", "lang": "en", "properties": {"organizationName": "depa Southern Branch"}},
    {"id": "techproduct_1734123456_1", "type": "TechProduct", "label": "Cloud CRM", "lang": "en", "properties": {"productName": "Cloud CRM"}},
    {"id": "budget_1734123456_1", "type": "Budget", "label": "1000000", "properties": {"budgetAmount": 1000000}},
    {"id": "location_1734123456_1", "type": "Location", "label": "Satun", "lang": "en", "properties": {"locationName": "Satun"}},
    {"id": "digitalization_1734123456_1", "type": "Digitalization", "label": "Digitalization Phase", "lang": "en"},
    {"id": "resultproject_1734123456_1", "type": "ResultProject", "label": "Citizen satisfaction +18%", "lang": "en"},
    {"id": "resultproject_1734123456_2", "type": "ResultProject", "label": "Response time -30%", "lang": "en"},
    {"id": "cultural_1734123456_1", "type": "Cultural", "label": "Cultural Dimension", "lang": "en"}
  ],
  "relations": [
    {"subject": "dxproject_1734123456_1", "predicate": "hasProjectDetail", "object": "organization_1734123456_1"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasProjectDetail", "object": "organization_1734123456_2"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasTechProduct", "object": "techproduct_1734123456_1"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasProjectDetail", "object": "budget_1734123456_1"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasProjectDetail", "object": "location_1734123456_1"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasPhase", "object": "digitalization_1734123456_1"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasProjectResult", "object": "resultproject_1734123456_1"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasProjectResult", "object": "resultproject_1734123456_2"},
    {"subject": "dxproject_1734123456_1", "predicate": "hasDimension", "object": "cultural_1734123456_1"}
  ]
}`,
          },
          {
            role: "user",
            content: `Extract all DX-related entities and relationships from this text. Return ONLY a JSON object in this format:

{
  "entities": [
    {"id": "unique_id", "type": "ClassName", "label": "Display Name", "lang": "th|en", "properties": {...}}
  ],
  "relations": [
    {"subject": "entity_id_1", "predicate": "propertyName", "object": "entity_id_2"}
  ]
}

IMPORTANT: Use this timestamp in ALL entity IDs: ${timestamp}
ID format: {type}_${timestamp}_{number}
Example: dxproject_${timestamp}_1, organization_${timestamp}_1

Text to analyze:
${text.substring(0, 5000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3000",
          "X-Title": process.env.YOUR_APP_NAME || "DX_Ontology_System",
        },
        timeout: 60000,
      }
    );

    // Parse LLM response
    console.log(
      "📦 Full API Response:",
      JSON.stringify(res.data, null, 2).substring(0, 800)
    );

    let content = res.data.choices?.[0]?.message?.content;
    const reasoning = res.data.choices?.[0]?.message?.reasoning;

    if (reasoning && (!content || content.trim() === "")) {
      console.log(
        "⚠️ Model returned reasoning instead of content. This model does not support json_object format."
      );
      console.log("💡 Please use one of these models instead:");
      console.log(
        "   - google/gemini-2.0-flash-exp:free (recommended, fast & free)"
      );
      console.log("   - openai/gpt-4o-mini (cheap & good)");
      console.log("   - anthropic/claude-3.5-sonnet (best quality)");
      throw new Error(
        "Model does not support structured JSON output. Change LLM_MODEL in .env file."
      );
    }

    if (!content || content.trim() === "" || content === "{}") {
      throw new Error("Empty LLM response");
    }

    console.log("✅ LLM Raw Response Length:", content.length);
    console.log(
      "✅ LLM Raw Response:",
      content.substring(0, 800) + (content.length > 800 ? "..." : "")
    );

    // Parse JSON (remove markdown if present)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    console.log(
      `✅ Parsed ${parsed.entities?.length || 0} entities, ${
        parsed.relations?.length || 0
      } relations`
    );

    // 🔹 Validate against schema
    const validationErrors = [];

    if (parsed.entities) {
      parsed.entities.forEach((entity, idx) => {
        const validation = schema.validateEntity(entity);
        if (!validation.valid) {
          console.warn(
            `⚠️  Entity ${idx} (${entity.type}): ${validation.errors.join(
              ", "
            )}`
          );
          validationErrors.push(...validation.errors);
        }
      });
    }

    if (parsed.relations) {
      parsed.relations.forEach((relation, idx) => {
        const validation = schema.validateRelation(relation);
        if (!validation.valid) {
          console.warn(
            `⚠️  Relation ${idx} (${
              relation.predicate
            }): ${validation.errors.join(", ")}`
          );
          validationErrors.push(...validation.errors);
        }
      });
    }

    if (validationErrors.length > 0) {
      console.warn(`⚠️  Found ${validationErrors.length} validation warnings`);
    } else {
      console.log("✅ All entities and relations validated successfully");
    }

    return parsed;
  } catch (e) {
    console.error("❌ LLM Error:", e.message);
    if (e.response) {
      console.error("Response status:", e.response.status);
      console.error("Response data:", e.response.data);
    }

    console.log("⚠️  Falling back to rule-based extraction");
    throw new Error(
      "ไม่สามารถสกัดข้อมูลด้วย LLM ได้ กรุณาตรวจสอบไฟล์หรือใช้ไฟล์อื่นแทน"
    );
  }
}
