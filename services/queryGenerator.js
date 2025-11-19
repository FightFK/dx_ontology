import axios from 'axios';
import { getSchemaLoader } from './ontologyLoader.js';
import { runSelect } from './graphdbClient.js';

const LLM_URL = process.env.LLM_URL || "https://llm-uat.105app.site/v1/chat/completions";

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

Namespace: <http://www.dxproject.com/ontology#>
`;

    console.log(`🤖 Generating SPARQL for question: "${question}"`);
    
    const res = await axios.post(
      LLM_URL,
      {
        model: "gpt-oss20b",
        messages: [
          {
            role: "system",
            content: `You are a SPARQL query generator expert. Generate valid SPARQL SELECT queries based on the ontology schema.

${schemaDescription}

IMPORTANT RULES:
1. Use PREFIX declarations: PREFIX : <http://www.dxproject.com/ontology#>
2. Always use proper SPARQL syntax
3. Return ONLY the SPARQL query, no explanations
4. Use FILTER for numerical/text comparisons
5. Use proper property paths for traversing relationships
6. Add LIMIT clause if not specified (default: 100)`
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
        },
        timeout: 30000
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
        model: "gpt-oss20b",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that explains database query results in natural language. Be concise and clear. Respond in Thai if the question is in Thai, English if in English."
          },
          {
            role: "user",
            content: `Question: ${question}

SPARQL Query executed:
${sparql}

Results:
${resultsText}

Please provide a natural language answer to the question based on these results. Be specific and mention key details.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000
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
