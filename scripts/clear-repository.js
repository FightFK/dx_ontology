import axios from 'axios';

const GRAPHDB_URL = process.env.GRAPHDB_URL || 'http://localhost:7200';
const REPO_NAME = process.env.REPO_NAME || 'dxOntology';

async function clearRepository() {
  try {
    console.log('🗑️  Clearing all statements from repository...');
    
    const response = await axios.delete(
      `${GRAPHDB_URL}/repositories/${REPO_NAME}/statements`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.status === 204 || response.status === 200) {
      console.log('✅ Repository cleared successfully!');
      
      // Verify
      const countResponse = await axios.get(
        `${GRAPHDB_URL}/repositories/${REPO_NAME}/size`
      );
      console.log(`📊 Statements remaining: ${countResponse.data}`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing repository:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.statusText}`);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

clearRepository();
