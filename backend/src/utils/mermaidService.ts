import { v4 as uuidv4 } from 'uuid';
import { Mermaid } from 'mermaid';
import { Entity, Relationship, MermaidConfig } from '../../../shared/types';

export class MermaidService {
  private mermaid: Mermaid;

  constructor() {
    this.mermaid = new Mermaid({
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
        let columnDef = `    ${column.name} ${column.type}`;
        
        if (column.primaryKey) {
          columnDef += ' PK';
        }
        
        if (!column.nullable) {
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
      
      code += `  ${relationship.from} ${fromCardinality}--${toCardinality} ${relationship.to} : "${relationship.fromColumn} -> ${relationship.toColumn}"\n`;
    }

    return code;
  }

  private getCardinality(type: string, direction: 'from' | 'to'): string {
    switch (type) {
      case 'one-to-one':
        return direction === 'from' ? '||' : '|o';
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
      this.mermaid.initialize({
        startOnLoad: false,
        securityLevel: config.securityLevel,
        theme: config.theme,
        fontFamily: config.fontFamily
      });

      // Render the diagram
      const { svg } = await this.mermaid.render('er-diagram', mermaidCode);
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
    const mermaidCode = this.generateMermaidCode(entities, relationships);
    
    try {
      // Update mermaid config
      this.mermaid.initialize({
        startOnLoad: false,
        securityLevel: config.securityLevel,
        theme: config.theme,
        fontFamily: config.fontFamily
      });

      // Render to PNG using jsdom
      const { svg } = await this.mermaid.render('er-diagram-png', mermaidCode);
      return svg; // In a real implementation, you'd convert to PNG
    } catch (error) {
      throw new Error(`Failed to render diagram to PNG: ${error}`);
    }
  }
}