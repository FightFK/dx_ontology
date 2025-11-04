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

## 🔧 Configuration

แก้ไขไฟล์ `.env`:
```
GRAPHDB_URL=http://localhost:7200
REPO_NAME=dxOntology
PORT=3000
API_KEY=your-llm-api-key
```

## 🛠 Troubleshooting

- หาก GraphDB ไม่เริ่ม: ตรวจสอบว่า port 7200 ไม่ถูกใช้งาน
- หาก upload ไฟล์ไม่ได้: ตรวจสอบว่ามีโฟลเดอร์ `uploads/` และ `rdf_output/`
- หาก LLM ไม่ตอบสนอง: ตรวจสอบ API_KEY ในไฟล์ `.env`" 
