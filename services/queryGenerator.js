import axios from 'axios';
import { getSchemaLoader } from './ontologyLoader.js';
import { runSelect } from './graphdbClient.js';

const LLM_URL = process.env.LLM_URL || "https://openrouter.ai/api/v1/chat/completions";
const LLM_MODEL = process.env.LLM_MODEL || "google/gemini-2.0-flash-exp:free";

/**
 * Convert natural language question to SPARQL query using LLM
 */
export async function generateSPARQL(question) {
  try {
    // Load schema for context
    const schema = await getSchemaLoader();
    const schemaContext = schema.getSchemaContext();
    
    const schemaDescription = `
Ontology Schema:

Classes:
${schemaContext.classes.map(c => `- ${c.name}: ${c.comment || c.label}`).join('\n')}

Object Properties:
${schemaContext.objectProperties.map(p => `- ${p.name}: connects ${p.domain} to ${p.range}`).join('\n')}

Datatype Properties:
${schemaContext.datatypeProperties.map(p => `- ${p.name} (domain: ${p.domain})`).join('\n')}

Predefined Instances:
${schemaContext.individuals.map(i => `- ${i.name} (${i.type})`).join('\n')}

Namespace: <http://localhost:3000/ontology/dx#>
`;

    console.log(`🤖 Generating SPARQL for question: "${question}"`);
    
    const res = await axios.post(
      LLM_URL,
      {
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a SPARQL query generator expert. Generate valid SPARQL SELECT queries based on the ontology schema.

${schemaDescription}

IMPORTANT RULES:
1. Use PREFIX declarations: PREFIX : <http://localhost:3000/ontology/dx#>
   Also include: PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
2. Always use proper SPARQL syntax
3. Return ONLY the SPARQL query, no explanations
4. Use FILTER for numerical/text comparisons and text search
5. Use proper property paths for traversing relationships
6. Add LIMIT clause if not specified (default: 100)

CRITICAL - Search Strategy:
- DO NOT use hard-coded URIs like :CitizenCare2_0
- Instead, use variables and FILTER to search by properties
- For project names: use ?project :projectName ?name . FILTER(CONTAINS(LCASE(?name), "citizen care"))
- For labels: use ?entity rdfs:label ?label . FILTER(CONTAINS(LCASE(?label), "search term"))
- Always use LCASE() and CONTAINS() for flexible text matching

Example:
WRONG: :CitizenCare2_0 :hasTechProduct ?tech .
RIGHT: ?project a :DXProject ; :projectName ?name ; :hasTechProduct ?tech . FILTER(CONTAINS(LCASE(?name), "citizen care"))`
          },
          {
            role: "user",
            content: `Generate a SPARQL SELECT query for this question:

"${question}"

Return ONLY the SPARQL query.`
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3000",
          "X-Title": process.env.YOUR_APP_NAME || "DX_Ontology_System"
        },
        timeout: 60000
      }
    );

    let sparql = res.data.choices?.[0]?.message?.content || "";
    
    // Clean up response (remove markdown code blocks if present)
    sparql = sparql.trim();
    if (sparql.startsWith("```sparql")) {
      sparql = sparql.replace(/^```sparql\s*/, "").replace(/```\s*$/, "");
    } else if (sparql.startsWith("```")) {
      sparql = sparql.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }
    
    console.log('✅ Generated SPARQL:', sparql);
    return sparql;
    
  } catch (error) {
    console.error('❌ Error generating SPARQL:', error.message);
    throw error;
  }
}

/**
 * Answer natural language question by:
 * 1. Converting to SPARQL
 * 2. Executing on GraphDB
 * 3. Formatting response in natural language
 */
export async function answerQuestion(question) {
  try {
    // Step 1: Generate SPARQL
    const sparql = await generateSPARQL(question);
    
    // Step 2: Execute query
    console.log('🔍 Executing SPARQL query...');
    const results = await runSelect(sparql);
    
    // Step 3: Format results with LLM
    console.log(`✅ Got ${results.results?.bindings?.length || 0} results`);
    
    const answer = await formatResults(question, sparql, results);
    
    return {
      question,
      sparql,
      results: results.results?.bindings || [],
      answer
    };
    
  } catch (error) {
    console.error('❌ Error answering question:', error.message);
    throw error;
  }
}

/**
 * Smart answer: Retrieve all relevant data then let LLM filter and answer
 * Better for complex questions that require reasoning
 */
export async function answerQuestionSmart(question) {
  try {
    console.log('🧠 Using smart retrieval strategy...');
    
    // Step 1: Retrieve ALL relevant entities based on question context
    let retrievalQuery = '';
    
    // Detect question type and retrieve appropriate data
    const lowerQ = question.toLowerCase();
    
    if (lowerQ.includes('technology') || lowerQ.includes('tech') || lowerQ.includes('เทคโนโลยี')) {
      // Get all tech products with their properties
      retrievalQuery = `
PREFIX : <http://localhost:3000/ontology/dx#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?tech ?techName ?techLabel ?project ?projectName
WHERE {
  ?tech a :TechProduct .
  OPTIONAL { ?tech :productName ?techName }
  OPTIONAL { ?tech rdfs:label ?techLabel }
  OPTIONAL { 
    ?project :hasTechProduct ?tech .
    ?project :projectName ?projectName .
  }
}
LIMIT 200`;
    } else if (lowerQ.includes('project') || lowerQ.includes('โปรเจกต์')) {
      // Get all projects with comprehensive details
      retrievalQuery = `
PREFIX : <http://localhost:3000/ontology/dx#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?project ?projectName ?tech ?techName ?org ?orgName ?result ?resultLabel 
       ?dimension ?dimensionLabel ?phase ?phaseLabel ?kpi ?kpiLabel
WHERE {
  ?project a :DXProject .
  OPTIONAL { ?project rdfs:label ?projectName }
  OPTIONAL { 
    ?project :hasTechProduct ?tech .
    OPTIONAL { ?tech rdfs:label ?techName }
  }
  OPTIONAL {
    ?project :hasProjectDetail ?org .
    ?org a :Organization .
    OPTIONAL { ?org rdfs:label ?orgName }
  }
  OPTIONAL {
    ?project :hasProjectResult ?result .
    OPTIONAL { ?result rdfs:label ?resultLabel }
  }
  OPTIONAL {
    ?project :hasDimension ?dimension .
    OPTIONAL { ?dimension rdfs:label ?dimensionLabel }
  }
  OPTIONAL {
    ?project :isCurrentlyInPhase ?phase .
    OPTIONAL { ?phase rdfs:label ?phaseLabel }
  }
  OPTIONAL {
    ?project :hasKPI ?kpi .
    OPTIONAL { ?kpi rdfs:label ?kpiLabel }
  }
}
LIMIT 500`;
    } else {
      // Default: Get all projects with comprehensive details
      retrievalQuery = `
PREFIX : <http://localhost:3000/ontology/dx#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?project ?projectName ?projectDescription ?tech ?techName ?org ?orgName 
       ?result ?resultLabel ?dimension ?dimensionLabel ?phase ?phaseLabel ?kpi ?kpiLabel
       ?budgetAmount ?budgetSource
WHERE {
  ?project a :DXProject .
  ?project rdfs:label ?projectName .
  OPTIONAL { ?project :projectDescription ?projectDescription }
  
  OPTIONAL { 
    ?project :hasTechProduct ?tech .
    ?tech rdfs:label ?techName .
  }
  OPTIONAL {
    ?project :hasProjectDetail ?detail .
    ?detail a :Organization .
    ?detail rdfs:label ?orgName .
  }
  OPTIONAL {
    ?project :hasProjectDetail ?budgetDetail .
    ?budgetDetail :budgetAmount ?budgetAmount .
    OPTIONAL { ?budgetDetail :budgetSource ?budgetSource }
  }
  OPTIONAL {
    ?project :hasProjectResult ?result .
    ?result rdfs:label ?resultLabel .
  }
  OPTIONAL {
    ?project :hasDimension ?dimension .
    ?dimension rdfs:label ?dimensionLabel .
  }
  OPTIONAL {
    ?project :isCurrentlyInPhase ?phase .
    ?phase rdfs:label ?phaseLabel .
  }
  OPTIONAL {
    ?project :hasKPI ?kpi .
    ?kpi rdfs:label ?kpiLabel .
  }
}
LIMIT 1000`;
    }
    
    console.log('🔍 Retrieving data:', retrievalQuery);
    const results = await runSelect(retrievalQuery);
    const bindings = results.results?.bindings || [];
    
    console.log(`✅ Retrieved ${bindings.length} records`);
    console.log('🔬 Sample bindings:', JSON.stringify(bindings.slice(0, 2), null, 2));
    
    if (bindings.length === 0) {
      return {
        question,
        sparql: retrievalQuery,
        results: [],
        answer: "ไม่พบข้อมูลในระบบ"
      };
    }
    
    // Group data by project (only for comprehensive project queries)
    let dataContext, structuredData;
    
    if (retrievalQuery.includes('budgetAmount')) {
      // Group data by project for better analysis
      const projectMap = {};
      bindings.forEach(b => {
        const projName = b.projectName?.value || 'Unknown';
        if (!projectMap[projName]) {
          projectMap[projName] = {
            name: projName,
            projectDescription: b.projectDescription?.value || null,
            technologies: new Set(),
            organizations: new Set(),
            results: new Set(),
            dimensions: new Set(),
            phases: new Set(),
            kpis: new Set(),
            budgetAmount: null,
            budgetSource: null
          };
        }
        
        if (b.techName?.value) projectMap[projName].technologies.add(b.techName.value);
        if (b.orgName?.value) projectMap[projName].organizations.add(b.orgName.value);
        if (b.resultLabel?.value) projectMap[projName].results.add(b.resultLabel.value);
        if (b.dimensionLabel?.value) projectMap[projName].dimensions.add(b.dimensionLabel.value);
        if (b.phaseLabel?.value) projectMap[projName].phases.add(b.phaseLabel.value);
        if (b.kpiLabel?.value) projectMap[projName].kpis.add(b.kpiLabel.value);
        if (b.budgetAmount?.value) projectMap[projName].budgetAmount = b.budgetAmount.value;
        if (b.budgetSource?.value) projectMap[projName].budgetSource = b.budgetSource.value;
      });
      
      // Convert Sets to Arrays
      structuredData = Object.values(projectMap).map(p => ({
        name: p.name,
        projectDescription: p.projectDescription,
        budgetAmount: p.budgetAmount,
        budgetSource: p.budgetSource,
        technologies: Array.from(p.technologies),
        organizations: Array.from(p.organizations),
        results: Array.from(p.results),
        dimensions: Array.from(p.dimensions),
        phases: Array.from(p.phases),
        kpis: Array.from(p.kpis)
      }));
      
      dataContext = JSON.stringify(structuredData, null, 2);
    } else {
      // Use raw bindings for other queries
      structuredData = bindings;
      dataContext = JSON.stringify(bindings, null, 2);
    }
    
    // Step 2: Let LLM analyze and answer from retrieved data
    // Step 2: Let LLM analyze and answer from retrieved data
    console.log('🤖 Analyzing data with LLM...');
    const res = await axios.post(
      LLM_URL,
      {
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant answering questions about Digital Transformation projects.

Rules:
- Answer based ONLY on the provided data
- If information is not in the data, say so clearly
- Be concise and clear
- Respond in the same language as the question`
          },
          {
            role: "user",
            content: `Here is data from our knowledge base (structured by project):

${dataContext}

Question: ${question}

Please answer the question based on the data above.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3000",
          "X-Title": process.env.YOUR_APP_NAME || "DX_Ontology_System"
        },
        timeout: 60000
      }
    );

    const answer = res.data.choices?.[0]?.message?.content || "ไม่สามารถวิเคราะห์ข้อมูลได้";
    console.log('✅ Generated smart answer');
    
    return {
      question,
      sparql: retrievalQuery,
      results: structuredData || bindings,
      answer,
      method: 'smart_retrieval'
    };
    
  } catch (error) {
    console.error('❌ Error in smart answer:', error.message);
    throw error;
  }
}

/**
 * Format SPARQL results into natural language answer
 */
async function formatResults(question, sparql, results) {
  try {
    const bindings = results.results?.bindings || [];
    
    if (bindings.length === 0) {
      return "ไม่พบข้อมูลที่ตรงกับคำถามของคุณในระบบ";
    }
    
    // Format results as text
    const resultsText = JSON.stringify(bindings, null, 2);
    
    console.log('🤖 Formatting results into natural language...');
    
    const res = await axios.post(
      LLM_URL,
      {
        model: LLM_MODEL,
        messages: [
          {
            role: "system",
            content: "You explain query results naturally. Answer in Thai for Thai questions, English for English questions."
          },
          {
            role: "user",
            content: `Question: ${question}

Query results:
${resultsText}

Important: 
- Use "value" field from results, NOT URIs
- For results (?resultLabel), show the actual description/text
- Be specific with numbers and names

Answer the question:`
          }
        ],
        temperature: 0.5,
        max_tokens: 500
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3000",
          "X-Title": process.env.YOUR_APP_NAME || "DX_Ontology_System"
        },
        timeout: 60000
      }
    );

    const answer = res.data.choices?.[0]?.message?.content || "ไม่สามารถสร้างคำตอบได้";
    console.log('✅ Generated answer');
    
    return answer;
    
  } catch (error) {
    console.error('❌ Error formatting results:', error.message);
    // Fallback: return raw results
    return `พบข้อมูล ${results.results?.bindings?.length || 0} รายการ`;
  }
}
