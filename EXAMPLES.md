# DX Ontology API Examples

## 🔹 ขาเข้า (Ingestion) - การเพิ่มข้อมูลเข้าระบบ

### 1. Upload PDF/Excel
```bash
curl -X POST http://localhost:3000/api/ingest/file \
  -F "file=@project_document.pdf"
```



### ตัวอย่าง JSON ที่ LLM จะ extract ออกมาเพื่อใส่ใน ontologyDB
```json
{
  "entities": [
    {
      "id": "project_1",
      "type": "DXProject",
      "label": "โครงการเกษตรอัจฉริยะจังหวัดยะลา",
      "lang": "th",
      "properties": {
        "projectName": "Smart Farm Yala",
        "startDate": "2024-01-15",
        "endDate": "2024-12-31"
      }
    },
    {
      "id": "budget_1",
      "type": "Budget",
      "label": "2000000",
      "properties": {
        "budgetAmount": 2000000,
        "currency": "THB"
      }
    },
    {
      "id": "kpi_1",
      "type": "KPI",
      "label": "เพิ่มผลผลิต 30%",
      "properties": {
        "kpiName": "Yield Increase",
        "kpiValue": "30%",
        "kpiTarget": "30"
      }
    },
    {
      "id": "drone_tech",
      "type": "TechProduct",
      "label": "Drone สำรวจ",
      "properties": {
        "productName": "Agricultural Drone DJI Agras"
      }
    }
  ],
  "relations": [
    {
      "subject": "project_1",
      "predicate": "hasDimension",
      "object": "Technological"
    },
    {
      "subject": "project_1",
      "predicate": "hasDimension",
      "object": "Innovation"
    },
    {
      "subject": "project_1",
      "predicate": "hasBudget",
      "object": "budget_1"
    },
    {
      "subject": "project_1",
      "predicate": "hasKPI",
      "object": "kpi_1"
    },
    {
      "subject": "project_1",
      "predicate": "hasTechProduct",
      "object": "drone_tech"
    },
    {
      "subject": "project_1",
      "predicate": "isCurrentlyInPhase",
      "object": "DigitalTransformation"
    }
  ]
}
```

## 🔹 ขาออก (Retrieval) - การ Query ข้อมูล

### 1. Natural Language Query
```json
POST /api/query/ask
Content-Type: application/json

{
  "question": "มีโครงการไหนบ้างที่ใช้ Drone?"
}
```

**Response:**
```json
{
  "ok": true,
  "question": "มีโครงการไหนบ้างที่ใช้ Drone?",
  "sparql": "PREFIX : <https://Dxonto.105app.site/Dx#>\nSELECT ?project ?projectName WHERE {\n  ?project a :DXProject ;\n           :projectName ?projectName ;\n           :hasTechProduct ?tech .\n  ?tech :productName ?techName .\n  FILTER(CONTAINS(LCASE(?techName), \"drone\"))\n}",
  "results": [
    {
      "project": { "type": "uri", "value": "https://Dxonto.105app.site/Dx#project_1" },
      "projectName": { "type": "literal", "value": "Smart Farm Yala" }
    }
  ],
  "answer": "พบ 1 โครงการที่ใช้ Drone คือ โครงการ Smart Farm Yala ซึ่งใช้เทคโนโลยี Drone สำหรับการสำรวจและติดตามพื้นที่เกษตร"
}
```

### 2. คำถามตัวอย่างเพิ่มเติม

**ค้นหาโครงการตาม Budget:**
```json
{
  "question": "โครงการไหนบ้างที่มี budget เกิน 1 ล้านบาท?"
}
```

**ค้นหาตาม Dimension:**
```json
{
  "question": "แสดงโครงการทั้งหมดที่เป็นมิติ Cultural"
}
```

**ค้นหาตาม Phase:**
```json
{
  "question": "โครงการใดบ้างที่อยู่ในเฟส Digital Transformation?"
}
```

**ค้นหาตาม KPI:**
```json
{
  "question": "โครงการใดมี KPI เกี่ยวกับการเพิ่มผลผลิต?"
}
```

**ค้นหาตาม Technology Category:**
```json
{
  "question": "มีโครงการอะไรบ้างในกลุ่ม Agriculture?"
}
```

**Query แบบซับซ้อน:**
```json
{
  "question": "โครงการที่มี budget เกิน 1 ล้าน และใช้ AI มีอะไรบ้าง?"
}
```

### 3. SPARQL Query โดยตรง
```json
POST /api/sparql/select
Content-Type: application/json

{
  "query": "PREFIX : <https://Dxonto.105app.site/Dx#>\nSELECT ?project ?name ?dimension WHERE {\n  ?project a :DXProject ;\n           :projectName ?name ;\n           :hasDimension ?dimension .\n} LIMIT 10"
}
```

### 4. Update ข้อมูล
```json
POST /api/sparql/update
Content-Type: application/json

{
  "update": "PREFIX : <https://Dxonto.105app.site/Dx#>\nINSERT DATA {\n  :project_1 :hasKPI :kpi_new .\n  :kpi_new a :KPI ;\n           :kpiName \"Cost Reduction\" ;\n           :kpiValue \"15%\" .\n}"
}
```

## 🔹 Health Check & Debug

### 1. ตรวจสอบระบบ
```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "ok": true,
  "repos": {
    "results": {
      "bindings": [
        {
          "id": { "value": "dxOntology" }
        }
      ]
    }
  }
}
```

### 2. ดู Schema ทั้งหมด
```json
POST /api/sparql/select

{
  "query": "PREFIX owl: <http://www.w3.org/2002/07/owl#>\nSELECT DISTINCT ?class WHERE {\n  ?class a owl:Class .\n} ORDER BY ?class"
}
```

### 3. ดู Properties ทั้งหมด
```json
POST /api/sparql/select

{
  "query": "PREFIX owl: <http://www.w3.org/2002/07/owl#>\nSELECT DISTINCT ?property WHERE {\n  ?property a owl:ObjectProperty .\n} ORDER BY ?property"
}
```

## 📝 Tips

1. **LLM จะทำงานดีที่สุดเมื่อ**: เอกสารมีโครงสร้างชัดเจน มีข้อมูลครบถ้วน
2. **Fallback mode**: ถ้า LLM ไม่ทำงาน ระบบจะใช้ rule-based extraction
3. **Validation**: ระบบจะ validate entities/relations กับ schema อัตโนมัติ
4. **Schema-aware**: LLM จะรู้ว่ามี classes และ properties อะไรบ้างจาก ontology
5. **Bilingual**: รองรับทั้งภาษาไทยและอังกฤษ
