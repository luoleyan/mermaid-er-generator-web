import { Entity, Relationship } from '../../../../shared/types';

export class MermaidGeneratorService {
  generateERDiagram(entities: Record<string, Entity>, relationships: Relationship[], title?: string): string {
    const lines: string[] = ['erDiagram'];
    
    if (title) {
      lines.push(`    %% ${title}`);
    }
    
    lines.push('');

    for (const entityName in entities) {
      const entity = entities[entityName];
      lines.push(this.generateEntityDefinition(entity));
      lines.push('');
    }

    for (const rel of relationships) {
      lines.push(`    ${this.generateRelationship(rel)}`);
    }

    return lines.join('\n');
  }

  private generateEntityDefinition(entity: Entity): string {
    const lines: string[] = [`    ${entity.name} {`];
    
    for (const attr of entity.attributes) {
      let line = `        ${attr.data_type} ${attr.name}`;
      
      if (attr.is_primary_key) line += ' PK';
      if (attr.is_foreign_key) line += ' FK';
      if (!attr.is_nullable && !attr.is_primary_key) line += ' NOT NULL';
      
      lines.push(line);
    }
    
    lines.push('    }');
    return lines.join('\n');
  }

  private generateRelationship(rel: Relationship): string {
    const symbols: Record<string, string> = {
      'one-to-one': '||--||',
      'one-to-many': '||--o{',
      'many-to-many': '}o--o{',
    };

    const symbol = symbols[rel.relationship_type] || '||--o{';
    
    if (rel.name) {
      return `${rel.from_entity} ${symbol} ${rel.to_entity} : "${rel.name}"`;
    } else {
      return `${rel.from_entity} ${symbol} ${rel.to_entity}`;
    }
  }

  generateMarkdown(entities: Record<string, Entity>, relationships: Relationship[], title?: string): string {
    const lines: string[] = [];
    
    lines.push(`# ${title || 'ER Diagram'}`);
    lines.push('');
    lines.push('## Diagram');
    lines.push('');
    lines.push('```mermaid');
    lines.push(this.generateERDiagram(entities, relationships, title));
    lines.push('```');
    lines.push('');
    lines.push('## Entities');
    lines.push('');
    
    for (const entityName in entities) {
      const entity = entities[entityName];
      lines.push(`### ${entity.name}`);
      if (entity.comment) {
        lines.push(`*${entity.comment}*`);
      }
      lines.push('');
      lines.push('| Field | Type | Constraints |');
      lines.push('|-------|------|-------------|');
      
      for (const attr of entity.attributes) {
        const constraints: string[] = [];
        if (attr.is_primary_key) constraints.push('PK');
        if (attr.is_foreign_key) constraints.push('FK');
        if (!attr.is_nullable) constraints.push('NOT NULL');
        
        lines.push(`| ${attr.name} | ${attr.data_type} | ${constraints.join(', ') || '-'} |`);
      }
      lines.push('');
    }

    if (relationships.length > 0) {
      lines.push('## Relationships');
      lines.push('');
      lines.push('| From | To | Type |');
      lines.push('|------|-----|------|');
      
      for (const rel of relationships) {
        lines.push(`| ${rel.from_entity} | ${rel.to_entity} | ${rel.relationship_type} |`);
      }
    }

    return lines.join('\n');
  }
}

export const mermaidGeneratorService = new MermaidGeneratorService();
