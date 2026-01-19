import axios from 'axios';
import fs from 'fs';

const GRAPHDB_URL = process.env.GRAPHDB_URL || 'http://localhost:7200';
const REPO_NAME = process.env.REPO_NAME || 'dxOntology';
const ONTOLOGY_FILE = 'ontology/dxProject.ttl';

async function uploadOntology() {
  try {
    console.log('📂 Reading ontology file...');
    const ontologyContent = fs.readFileSync(ONTOLOGY_FILE, 'utf-8');
    
    console.log(`📤 Uploading ontology to ${GRAPHDB_URL}/repositories/${REPO_NAME}...`);
    
    const response = await axios.post(
      `${GRAPHDB_URL}/repositories/${REPO_NAME}/statements`,
      ontologyContent,
      {
        headers: {
          'Content-Type': 'text/turtle'
        }
      }
    );
    
    if (response.status === 204 || response.status === 200) {
      console.log('✅ Ontology uploaded successfully!');
      
      // Verify upload
      const countResponse = await axios.get(
        `${GRAPHDB_URL}/repositories/${REPO_NAME}/size`
      );
      console.log(`📊 Total statements in repository: ${countResponse.data}`);
    }
    
  } catch (error) {
    console.error('❌ Error uploading ontology:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.statusText}`);
      console.error(`   Data:`, error.response.data);
    } else {
      console.error(`   ${error.message}`);
    }
    
    console.log('\n💡 Make sure:');
    console.log('   1. GraphDB is running (docker-compose up -d)');
    console.log('   2. Repository "dxOntology" exists');
    console.log('   3. Check .env file for correct GRAPHDB_URL and REPO_NAME');
    
    process.exit(1);
  }
}

uploadOntology();
