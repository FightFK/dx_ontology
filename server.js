import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import ingestRouter from "./routes/ingest.js";
import healthRouter from './routes/health.js';
import sparqlRouter from './routes/sparql.js';
import rdfRouter from './routes/rdf.js';
import queryRouter from './routes/query.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(morgan('dev'));

app.use('/api/health', healthRouter);
app.use('/api/sparql', sparqlRouter);
app.use('/api/rdf', rdfRouter);
app.use("/api/ingest", ingestRouter);
app.use('/api/query', queryRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DX Ontology API running on http://localhost:${PORT}`);
});
