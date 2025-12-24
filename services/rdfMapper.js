import { DataFactory, Writer } from 'n3';
const { namedNode, literal, quad } = DataFactory;

// Namespace ตรงกับ dxProject.ttl
const DX = 'http://localhost:3000/ontology/dx#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

export function jsonToTurtle(doc) {
  // doc = { entities: [...], relations: [...], datatypeProperties: [...] }
  const writer = new Writer({
    prefixes: { 
      '': 'http://localhost:3000/ontology/dx#',
      rdf: RDF, 
      rdfs: RDFS,
      xsd: XSD,
      owl: 'http://www.w3.org/2002/07/owl#'
    }
  });

  // Entities (Individuals/Instances)
  (doc.entities || []).forEach((e) => {
    const entityUri = `${DX}${e.id}`;
    const typeUri = `${DX}${e.type}`;
    
    // Add type declaration
    writer.addQuad(quad(
      namedNode(entityUri),
      namedNode(`${RDF}type`),
      namedNode(typeUri)
    ));
    
    // Add label if exists
    if (e.label) {
      writer.addQuad(quad(
        namedNode(entityUri),
        namedNode(`${RDFS}label`),
        literal(e.label, e.lang || 'th')
      ));
    }
    
    // Add datatype properties if exists
    if (e.properties) {
      Object.entries(e.properties).forEach(([propName, propValue]) => {
        const propUri = `${DX}${propName}`;
        let literalValue;
        
        // Handle different data types
        if (typeof propValue === 'number') {
          literalValue = literal(propValue.toString(), namedNode(`${XSD}decimal`));
        } else if (propValue instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(propValue)) {
          literalValue = literal(propValue.toString().split('T')[0], namedNode(`${XSD}date`));
        } else {
          literalValue = literal(propValue.toString());
        }
        
        writer.addQuad(quad(
          namedNode(entityUri),
          namedNode(propUri),
          literalValue
        ));
      });
    }
  });

  // Object Properties (Relations)
  (doc.relations || []).forEach((r) => {
    const subjectUri = `${DX}${r.subject}`;
    const predicateUri = `${DX}${r.predicate}`;
    const objectUri = `${DX}${r.object}`;
    
    writer.addQuad(quad(
      namedNode(subjectUri),
      namedNode(predicateUri),
      namedNode(objectUri)
    ));
  });

  return new Promise((resolve, reject) => {
    writer.end((err, ttl) => (err ? reject(err) : resolve(ttl)));
  });
}
