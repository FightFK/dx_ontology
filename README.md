"# DX Ontology Project

โปรเจกต์สำหรับจัดการ Ontology ของ DX โดยใช้ GraphDB และ LLM สำหรับการแปลงเอกสารเป็น RDF

## 🚀 วิธีการใช้งาน

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. เริ่ม GraphDB ผ่าน Docker
```bash
docker-compose up -d
```

เข้าใช้งาน GraphDB UI ได้ที่: http://localhost:7200

### 3. เริ่ม API Server
```bash
npm start
```

หรือสำหรับ Development (auto-reload):
```bash
npm run dev
```

Server จะทำงานที่: http://localhost:3000

## 📡 API Endpoints

### Health Check
```bash
GET /api/health
```

### Upload และแปลงไฟล์เป็น Ontology (PDF/Excel)
```bash
POST /api/ingest/file
Content-Type: multipart/form-data
Body: file=@yourfile.pdf
```

### Upload RDF/Turtle โดยตรง
```bash
POST /api/rdf/string
Content-Type: application/json
Body: { "turtle": "@prefix ex: <http://example.org/> ..." }
```

```bash
POST /api/rdf/file
Content-Type: multipart/form-data
Body: file=@yourfile.ttl
```

### SPARQL Query
```bash
POST /api/sparql/select
Content-Type: application/json
Body: { "query": "SELECT * WHERE { ?s ?p ?o } LIMIT 10" }
```

### SPARQL Update
```bash
POST /api/sparql/update
Content-Type: application/json
Body: { "update": "INSERT DATA { <http://example.org/subject> <http://example.org/predicate> <http://example.org/object> }" }
```

### Natural Language Query (ขาออก - Retrieval)
```bash
POST /api/query/ask
Content-Type: application/json
Body: { 
  "question": "โครงการไหนบ้างที่มี budget เกิน 1 ล้านบาท?" 
}
```

Response จะมี:
- `sparql`: SPARQL query ที่ถูก generate
- `results`: ผลลัพธ์จาก GraphDB
- `answer`: คำตอบภาษาธรรมชาติ

### Generate SPARQL Only
```bash
POST /api/query/sparql
Content-Type: application/json
Body: { 
  "question": "แสดงโครงการทั้งหมดที่เป็น Cultural dimension" 
}
```

## 🔧 Configuration

แก้ไขไฟล์ `.env`:
```env
GRAPHDB_URL=http://localhost:7200
REPO_NAME=dxOntology
PORT=3000

# LLM Configuration (gpt-oss20b บน vLLM)
LLM_URL=https://llm-uat.105app.site/v1/chat/completions
API_KEY=your-api-key-here
```

## 🏗 Architecture

### ขาเข้า (Ingestion Pipeline)
```
PDF/Excel → Feature Extraction (LLM) → Schema Validation → RDF Mapping → GraphDB
```

1. **Schema Loading**: โหลด Ontology จาก `ontology/dx_ontology.ttl`
2. **LLM Extraction**: ใช้ LLM ดึง entities และ relationships จากเอกสาร
3. **Validation**: ตรวจสอบว่าตรงกับ schema หรือไม่
4. **RDF Mapping**: แปลง JSON เป็น Turtle format
5. **Ingestion**: บันทึกเข้า GraphDB

### ขาออก (Retrieval Pipeline)
```
Natural Language Question → Text-to-SPARQL (LLM) → Execute on GraphDB → Format Answer (LLM)
```

1. **Schema Context**: ส่ง Ontology schema ให้ LLM
2. **SPARQL Generation**: LLM สร้าง SPARQL query
3. **Execution**: รัน query บน GraphDB
4. **Answer Generation**: LLM แปลงผลลัพธ์เป็นภาษาธรรมชาติ

## 📊 Ontology Schema

Based on `dxProject.ttl`:

**Main Classes:**
- `DXProject` - โครงการ DX
- `DXDimension` - มิติการแปลงรูป (Cultural, Security, Innovation, etc.)
- `DXPhase` - เฟสของโครงการ (Digitization, Digitalization, Digital Transformation)
- `KPI` - ตัวชี้วัดความสำเร็จ
- `ProjectDetail` - รายละเอียดโครงการ (Budget, Location, Organization)
- `TechProduct` - เทคโนโลยีที่ใช้
- `DigitalProvider` - ผู้ให้บริการดิจิทัล

**Key Properties:**
- `hasDimension`, `hasKPI`, `hasTechProduct`, `hasProjectDetail`
- `projectName`, `startDate`, `endDate`, `budgetAmount`
- `kpiName`, `kpiValue`, `productName`

## 🛠 Troubleshooting

- **GraphDB ไม่เริ่ม**: ตรวจสอบว่า port 7200 ไม่ถูกใช้งาน
- **Upload ไฟล์ไม่ได้**: ตรวจสอบว่ามีโฟลเดอร์ `uploads/` และ `rdf_output/`
- **LLM error 404**: ตรวจสอบ `LLM_URL` และ `API_KEY` ในไฟล์ `.env`
- **PDF อ่านไม่ได้**: PDF อาจเป็นรูปภาพ ต้องใช้ OCR
- **Schema validation failed**: ตรวจสอบว่าใช้ class และ property ที่มีใน ontology" 
