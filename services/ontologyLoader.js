import fs from 'fs';
import { Parser, Store } from 'n3';

/**
 * Load and parse OWL/Turtle ontology schema
 * Extract Classes, Properties, and their relationships
 */
export class OntologySchemaLoader {
  constructor(schemaPath) {
    this.schemaPath = schemaPath;
    this.store = new Store();
    this.classes = new Map();
    this.objectProperties = new Map();
    this.datatypeProperties = new Map();
    this.individuals = new Map();
  }

  async load() {
    const ttlContent = fs.readFileSync(this.schemaPath, 'utf-8');
    const parser = new Parser();
    
    return new Promise((resolve, reject) => {
      parser.parse(ttlContent, (error, quad, prefixes) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (quad) {
          this.store.addQuad(quad);
        } else {
          // Parsing complete
          this.extractClasses();
          this.extractProperties();
          this.extractIndividuals();
          resolve();
        }
      });
    });
  }

  extractClasses() {
    const quads = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#Class');
    
    quads.forEach(quad => {
      const className = this.getLocalName(quad.subject.value);
      const labels = this.getLabels(quad.subject.value);
      const comment = this.getComment(quad.subject.value);
      
      this.classes.set(className, {
        uri: quad.subject.value,
        name: className,
        labels,
        comment
      });
    });
  }

  extractProperties() {
    // Object Properties
    const objProps = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#ObjectProperty');
    objProps.forEach(quad => {
      const propName = this.getLocalName(quad.subject.value);
      const domain = this.getPropertyValue(quad.subject.value, 'http://www.w3.org/2000/01/rdf-schema#domain');
      const range = this.getPropertyValue(quad.subject.value, 'http://www.w3.org/2000/01/rdf-schema#range');
      
      this.objectProperties.set(propName, {
        uri: quad.subject.value,
        name: propName,
        domain: domain ? this.getLocalName(domain) : null,
        range: range ? this.getLocalName(range) : null,
        labels: this.getLabels(quad.subject.value)
      });
    });

    // Datatype Properties
    const dataProps = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2002/07/owl#DatatypeProperty');
    dataProps.forEach(quad => {
      const propName = this.getLocalName(quad.subject.value);
      const domain = this.getPropertyValue(quad.subject.value, 'http://www.w3.org/2000/01/rdf-schema#domain');
      const range = this.getPropertyValue(quad.subject.value, 'http://www.w3.org/2000/01/rdf-schema#range');
      
      this.datatypeProperties.set(propName, {
        uri: quad.subject.value,
        name: propName,
        domain: domain ? this.getLocalName(domain) : null,
        range: range ? this.getLocalName(range) : null,
        labels: this.getLabels(quad.subject.value)
      });
    });
  }

  extractIndividuals() {
    // Find all individuals (instances of classes)
    this.classes.forEach((classInfo, className) => {
      const instances = this.store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', classInfo.uri);
      instances.forEach(quad => {
        const individualName = this.getLocalName(quad.subject.value);
        this.individuals.set(individualName, {
          uri: quad.subject.value,
          name: individualName,
          type: className,
          labels: this.getLabels(quad.subject.value)
        });
      });
    });
  }

  getLocalName(uri) {
    return uri.split('#').pop().split('/').pop();
  }

  getLabels(subjectUri) {
    const labelQuads = this.store.getQuads(subjectUri, 'http://www.w3.org/2000/01/rdf-schema#label', null);
    const labels = {};
    labelQuads.forEach(quad => {
      const lang = quad.object.language || 'default';
      labels[lang] = quad.object.value;
    });
    return labels;
  }

  getComment(subjectUri) {
    const commentQuad = this.store.getQuads(subjectUri, 'http://www.w3.org/2000/01/rdf-schema#comment', null)[0];
    return commentQuad ? commentQuad.object.value : null;
  }

  getPropertyValue(subjectUri, propertyUri) {
    const quad = this.store.getQuads(subjectUri, propertyUri, null)[0];
    return quad ? quad.object.value : null;
  }

  /**
   * Generate LLM prompt context with schema information
   */
  getSchemaContext() {
    const context = {
      classes: Array.from(this.classes.values()).map(c => ({
        name: c.name,
        label: c.labels.en || c.labels.th || c.name,
        comment: c.comment
      })),
      objectProperties: Array.from(this.objectProperties.values()).map(p => ({
        name: p.name,
        label: p.labels.en || p.labels.th || p.name,
        domain: p.domain,
        range: p.range
      })),
      datatypeProperties: Array.from(this.datatypeProperties.values()).map(p => ({
        name: p.name,
        label: p.labels.en || p.labels.th || p.name,
        domain: p.domain,
        range: p.range
      })),
      individuals: Array.from(this.individuals.values()).map(i => ({
        name: i.name,
        type: i.type,
        label: i.labels.en || i.labels.th || i.name
      }))
    };

    return context;
  }

  /**
   * Validate extracted entities against schema
   */
  validateEntity(entity) {
    const errors = [];
    
    // Check if entity type exists in schema
    if (!this.classes.has(entity.type)) {
      errors.push(`Unknown class type: ${entity.type}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate relationship against schema
   */
  validateRelation(relation) {
    const errors = [];
    
    // Check if predicate exists
    if (!this.objectProperties.has(relation.predicate)) {
      errors.push(`Unknown property: ${relation.predicate}`);
    } else {
      const prop = this.objectProperties.get(relation.predicate);
      
      // You could add domain/range validation here if needed
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
let schemaLoader = null;

export async function getSchemaLoader() {
  if (!schemaLoader) {
    schemaLoader = new OntologySchemaLoader('ontology/dxProject.ttl');
    await schemaLoader.load();
    console.log('✅ Ontology schema loaded successfully');
    console.log(`   Classes: ${schemaLoader.classes.size}`);
    console.log(`   Object Properties: ${schemaLoader.objectProperties.size}`);
    console.log(`   Datatype Properties: ${schemaLoader.datatypeProperties.size}`);
  }
  return schemaLoader;
}
