import { DataFactory, Writer } from 'n3';
const { namedNode, literal, quad } = DataFactory;

// namespace ของคุณ — แก้ให้ตรงกับ ontology
const EX = 'http://www.dxproject.com#';

export function jsonToTurtle(doc) {
  // doc = { entities: [...], relations: [...] }
  const writer = new Writer({
    prefixes: { ex: EX, rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', rdfs: 'http://www.w3.org/2000/01/rdf-schema#' }
  });

  // entities
  (doc.entities || []).forEach((e) => {
    writer.addQuad(quad(
      namedNode(`${EX}${e.id}`),
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      namedNode(`${EX}${e.type}`)
    ));
    if (e.label) {
      writer.addQuad(quad(
        namedNode(`${EX}${e.id}`),
        namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        literal(e.label, e.lang || undefined)
      ));
    }
  });

  // relations
  (doc.relations || []).forEach((r) => {
    writer.addQuad(quad(
      namedNode(`${EX}${r.subject}`),
      namedNode(`${EX}${r.predicate}`),
      namedNode(`${EX}${r.object}`)
    ));
  });

  return new Promise((resolve, reject) => {
    writer.end((err, ttl) => (err ? reject(err) : resolve(ttl)));
  });
}
