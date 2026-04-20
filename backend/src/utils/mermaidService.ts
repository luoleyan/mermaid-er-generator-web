import { v4 as uuidv4 } from 'uuid';
import mermaid from 'mermaid';
import { Entity, Relationship } from '../types';

export interface MermaidConfig {
  theme: string;
  securityLevel: 'loose' | 'strict' | 'antiscript';
  fontFamily: string;
}

export class MermaidService {
  constructor() {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
      fontFamily: 'sans-serif'
    });
  }

  private generateMermaidCode(entities: Entity[], relationships: Relationship[]): string {
    let code = 'erDiagram\n';
    
    // Generate entity definitions
    for (const entity of entities) {
      code += `  ${entity.name} {\n`;
      
      for (const column of entity.columns) {
        let columnDef = `    ${column.type} ${column.name}`;
        
        if (column.primaryKey) {
          columnDef += ' PK';
        }
        
        if (column.foreignKey) {
          columnDef += ' FK';
        }
        
        if (!column.nullable && !column.primaryKey) {
          columnDef += ' NOT NULL';
        }
        
        code += `${columnDef}\n`;
      }
      
      code += '  }\n\n';
    }

    // Generate relationships
    for (const relationship of relationships) {
      const fromCardinality = this.getCardinality(relationship.type, 'from');
      const toCardinality = this.getCardinality(relationship.type, 'to');
      
      code += `  ${relationship.from} ${fromCardinality}--${toCardinality} ${relationship.to} : "${relationship.fromColumn || ''} -> ${relationship.toColumn || ''}"\n`;
    }

    return code;
  }

  private getCardinality(type: string, direction: 'from' | 'to'): string {
    switch (type) {
      case 'one-to-one':
        return direction === 'from' ? '||' : '||';
      case 'one-to-many':
        return direction === 'from' ? '||' : 'o{';
      case 'many-to-one':
        return direction === 'from' ? 'o{' : '||';
      case 'many-to-many':
        return direction === 'from' ? 'o{' : '}o';
      default:
        return '--';
    }
  }

  async generateDiagram(
    entities: Entity[], 
    relationships: Relationship[], 
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif' }
  ): Promise<string> {
    const mermaidCode = this.generateMermaidCode(entities, relationships);
    
    try {
      // Update mermaid config
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: config.securityLevel,
        theme: config.theme,
        fontFamily: config.fontFamily
      });

      // Render the diagram
      const { svg } = await mermaid.render(`er-diagram-${uuidv4()}`, mermaidCode);
      return svg;
    } catch (error) {
      throw new Error(`Failed to generate Mermaid diagram: ${error}`);
    }
  }

  async renderToPNG(
    entities: Entity[], 
    relationships: Relationship[], 
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif' }
  ): Promise<string> {
    // For now, just return SVG. In a real implementation, you'd convert to PNG
    return this.generateDiagram(entities, relationships, config);
  }
}

export const mermaidService = new MermaidService();
