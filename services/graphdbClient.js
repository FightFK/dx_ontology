import axios from 'axios';

const GRAPHDB_URL = process.env.GRAPHDB_URL || 'http://localhost:7200';
const REPO_NAME   = process.env.REPO_NAME   || 'dxProject';

// รัน SELECT/DESCRIBE/ASK
export async function runSelect(query) {
  const res = await axios.get(`${GRAPHDB_URL}/repositories/${REPO_NAME}`, {
    params: { query },
    headers: { Accept: 'application/sparql-results+json' }
  });
  return res.data;
}

// รัน UPDATE (INSERT/DELETE)
export async function runUpdate(updateQuery) {
  const res = await axios.post(`${GRAPHDB_URL}/repositories/${REPO_NAME}/statements`, updateQuery, {
    headers: { 'Content-Type': 'application/sparql-update' }
  });
  return res.status === 204;
}

// อัปโหลด Turtle ทั้งไฟล์ (เพิ่มเป็น statements)
export async function uploadTurtle(turtleString) {
  const res = await axios.post(
    `${GRAPHDB_URL}/repositories/${REPO_NAME}/statements`,
    turtleString,
    { headers: { 'Content-Type': 'text/turtle' } }
  );
  return res.status === 204;
}

// ลิสต์ repositories (debug)
export async function listRepositories() {
  const res = await axios.get(`${GRAPHDB_URL}/repositories`, {
    headers: { Accept: 'application/sparql-results+json' }
  });
  return res.data;
}
