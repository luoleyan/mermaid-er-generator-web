import { v4 as uuidv4 } from 'uuid';
import { Entity, Relationship } from '../types';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

export interface MermaidConfig {
  theme: string;
  securityLevel: 'loose' | 'strict' | 'antiscript';
  fontFamily: string;
  viewMode?: 'classic' | 'physical' | 'chen';
  chenPinnedEntities?: string[];
}

type MermaidInstance = (typeof import('mermaid'))['default'];

export class MermaidService {
  private mermaid: MermaidInstance | null = null;

  private static readonly ASSOCIATIVE_TABLE_MIN_FOREIGN_KEYS = 2;
  private static readonly CHEN_PRIMARY_ANCHOR_PINNED = ['USERS', 'ARTICLES'];

  private async getMermaid(): Promise<MermaidInstance> {
    if (!this.mermaid) {
      const module = await import('mermaid');
      this.mermaid = module.default;
      this.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'default',
        fontFamily: 'sans-serif'
      });
    }

    return this.mermaid;
  }

  private initMermaidConfig(mermaid: MermaidInstance, config: MermaidConfig): void {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: config.securityLevel,
      theme: config.theme,
      fontFamily: config.fontFamily
    });
  }

  private generateMermaidCode(
    entities: Entity[],
    relationships: Relationship[],
    viewMode: 'classic' | 'physical' | 'chen' = 'classic',
    chenPinnedEntities: string[] = []
  ): string {
    if (viewMode === 'chen') {
      return this.generateChenMermaidCode(entities, relationships, chenPinnedEntities);
    }

    const { displayEntities, displayRelationships } =
      viewMode === 'classic'
        ? this.normalizeForClassicER(entities, relationships)
        : { displayEntities: entities, displayRelationships: relationships };
    let code = 'erDiagram\n';
    
    // Generate entity definitions
    for (const entity of displayEntities) {
      code += `  ${entity.name} {\n`;
      
      for (const column of entity.columns) {
        let columnDef = `    ${column.type} ${column.name}`;
        
        if (column.primaryKey) {
          columnDef += ' PK';
        }
        
        if (column.foreignKey) {
          columnDef += ' FK';
        }

        if (column.unique && !column.primaryKey) {
          columnDef += ' UK';
        }
        
        if (!column.nullable && !column.primaryKey) {
          columnDef += ' NOT NULL';
        }

        if (column.defaultValue) {
          const normalizedDefault = this.normalizeDefaultValueForMermaid(column.defaultValue);
          if (normalizedDefault) {
            columnDef += ` DEFAULT_${normalizedDefault}`;
          }
        }
        
        code += `${columnDef}\n`;
      }
      
      code += '  }\n\n';
    }

    // Generate relationships
    for (const relationship of displayRelationships) {
      const fromCardinality = this.getCardinality(relationship.type, 'from');
      const toCardinality = this.getCardinality(relationship.type, 'to');
      const relationName = relationship.name || `${relationship.to}.${relationship.toColumn || '?'} -> ${relationship.from}.${relationship.fromColumn || '?'}`;

      code += `  ${relationship.from} ${fromCardinality}--${toCardinality} ${relationship.to} : "${relationName}"\n`;
    }

    return code;
  }

  generateDiagramCode(
    entities: Entity[],
    relationships: Relationship[],
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): string {
    return this.generateMermaidCode(
      entities,
      relationships,
      config.viewMode || 'classic',
      config.chenPinnedEntities || []
    );
  }

  private generateChenMermaidCode(
    entities: Entity[],
    relationships: Relationship[],
    chenPinnedEntities: string[] = []
  ): string {
    const lines: string[] = ['flowchart LR'];

    for (const entity of entities) {
      const entityNode = this.chenEntityNodeId(entity.name);
      const leftBucket = `${entityNode}_ATTR_LEFT`;
      const rightBucket = `${entityNode}_ATTR_RIGHT`;
      const [leftColumns, rightColumns] = this.splitColumnsForChen(entity.columns);

      // Entity centered, attributes distributed on both sides for textbook-like Chen look.
      lines.push(`  subgraph ${entityNode}_GROUP[" "]`);
      lines.push('    direction LR');
      lines.push(`    subgraph ${leftBucket}[" "]`);
      lines.push('      direction TB');
      for (const column of leftColumns) {
        const attrNode = this.chenEntityAttrNodeId(entity.name, column.name);
        const attrLabel = column.primaryKey ? `<u>${column.name}</u>` : column.name;
        lines.push(`      ${attrNode}(("${attrLabel}"))`);
      }
      lines.push('    end');
      lines.push(`    ${entityNode}["${entity.name}"]`);
      lines.push(`    subgraph ${rightBucket}[" "]`);
      lines.push('      direction TB');
      for (const column of rightColumns) {
        const attrNode = this.chenEntityAttrNodeId(entity.name, column.name);
        const attrLabel = column.primaryKey ? `<u>${column.name}</u>` : column.name;
        lines.push(`      ${attrNode}(("${attrLabel}"))`);
      }
      lines.push('    end');
      lines.push('  end');

      for (const column of entity.columns) {
        const attrNode = this.chenEntityAttrNodeId(entity.name, column.name);
        lines.push(`  ${entityNode} --- ${attrNode}`);
      }
    }

    // Global anchor grid: keep entity positions stable and reduce vertical drift.
    const anchorColumns = this.buildChenEntityAnchorColumns(entities, relationships, chenPinnedEntities);
    lines.push('  subgraph CHEN_ENTITY_ANCHOR_GRID[" "]');
    lines.push('    direction LR');
    lines.push('    subgraph CHEN_ANCHOR_PRIMARY["主实体"]');
    lines.push('      direction TB');
    for (const entityName of anchorColumns.primary) {
      lines.push(`      ${this.chenEntityNodeId(entityName)}`);
    }
    lines.push('    end');
    lines.push('    subgraph CHEN_ANCHOR_CORE["核心实体"]');
    lines.push('      direction TB');
    for (const entityName of anchorColumns.core) {
      lines.push(`      ${this.chenEntityNodeId(entityName)}`);
    }
    lines.push('    end');
    lines.push('    subgraph CHEN_ANCHOR_EDGE["边缘实体"]');
    lines.push('      direction TB');
    for (const entityName of anchorColumns.edge) {
      lines.push(`      ${this.chenEntityNodeId(entityName)}`);
    }
    lines.push('    end');
    lines.push('  end');

    const sortedRelationships = [...relationships].sort((a, b) =>
      `${a.from}|${a.to}|${a.name || ''}`.localeCompare(`${b.from}|${b.to}|${b.name || ''}`)
    );

    for (const relationship of sortedRelationships) {
      const relationshipLabel = relationship.name || `${relationship.from}_to_${relationship.to}`;
      const relationshipNode = this.chenRelationshipNodeId(
        relationship.from,
        relationship.to,
        relationshipLabel
      );
      const rowNode = `${relationshipNode}_ROW`;
      const relationTopAttr = `${relationshipNode}_TOP_ATTRS`;
      const relationBottomAttr = `${relationshipNode}_BOTTOM_ATTRS`;
      const relatedAttributes = [relationship.fromColumn, relationship.toColumn].filter(
        (value): value is string => !!value
      );
      const midpoint = Math.ceil(relatedAttributes.length / 2);
      const topAttrs = relatedAttributes.slice(0, midpoint);
      const bottomAttrs = relatedAttributes.slice(midpoint);
      const oriented = this.orientChenRelationship(relationship);
      const topAttrNodes: string[] = [];
      const bottomAttrNodes: string[] = [];

      // Relationship in the middle, with optional relationship attributes around it.
      lines.push(`  subgraph ${relationshipNode}_GROUP[" "]`);
      lines.push('    direction TB');
      lines.push(`    subgraph ${rowNode}[" "]`);
      lines.push('      direction LR');
      lines.push(`      ${oriented.leftEntityNode}["${oriented.leftEntityLabel}"]`);
      lines.push(`      ${relationshipNode}{"${relationshipLabel}"}`);
      lines.push(`      ${oriented.rightEntityNode}["${oriented.rightEntityLabel}"]`);
      lines.push('    end');
      lines.push(`    subgraph ${relationTopAttr}[" "]`);
      lines.push('      direction LR');
      for (const attr of topAttrs) {
        const attrNode = this.chenRelationAttrNodeId(relationship.from, relationship.to, 'from', attr);
        topAttrNodes.push(attrNode);
        lines.push(`      ${attrNode}(("${attr}"))`);
      }
      lines.push('    end');
      lines.push(`    subgraph ${relationBottomAttr}[" "]`);
      lines.push('      direction LR');
      for (const attr of bottomAttrs) {
        const attrNode = this.chenRelationAttrNodeId(relationship.from, relationship.to, 'to', attr);
        bottomAttrNodes.push(attrNode);
        lines.push(`      ${attrNode}(("${attr}"))`);
      }
      lines.push('    end');
      lines.push('  end');

      lines.push(`  ${oriented.leftEntityNode} -- "${oriented.leftCardinality}" --- ${relationshipNode}`);
      lines.push(`  ${relationshipNode} -- "${oriented.rightCardinality}" --- ${oriented.rightEntityNode}`);

      for (const node of topAttrNodes) {
        lines.push(`  ${relationshipNode} --- ${node}`);
      }
      for (const node of bottomAttrNodes) {
        lines.push(`  ${relationshipNode} --- ${node}`);
      }
    }

    return lines.join('\n');
  }

  private buildChenEntityAnchorColumns(
    entities: Entity[],
    relationships: Relationship[],
    chenPinnedEntities: string[] = []
  ): { primary: string[]; core: string[]; edge: string[] } {
    const degreeMap = new Map<string, number>();
    for (const entity of entities) {
      degreeMap.set(entity.name, 0);
    }

    for (const relationship of relationships) {
      degreeMap.set(relationship.from, (degreeMap.get(relationship.from) || 0) + 1);
      degreeMap.set(relationship.to, (degreeMap.get(relationship.to) || 0) + 1);
    }

    const sortedByWeight = [...entities]
      .map((entity) => ({
        name: entity.name,
        degree: degreeMap.get(entity.name) || 0
      }))
      .sort((a, b) => {
        if (b.degree !== a.degree) {
          return b.degree - a.degree;
        }
        return a.name.localeCompare(b.name);
      });

    const pinnedUpper = new Set(
      this.getPinnedPrimaryAnchors(chenPinnedEntities).map((name) => name.toUpperCase())
    );
    const pinned = sortedByWeight
      .filter((item) => pinnedUpper.has(item.name.toUpperCase()))
      .map((item) => item.name);
    const unpinned = sortedByWeight.filter((item) => !pinnedUpper.has(item.name.toUpperCase()));

    const total = sortedByWeight.length;
    const primaryCut = Math.max(1, Math.ceil(total * 0.25));
    const coreCut = Math.max(primaryCut + 1, Math.ceil(total * 0.65));
    const primary = [...pinned, ...unpinned.slice(0, Math.max(primaryCut - pinned.length, 0)).map((item) => item.name)];
    const remaining = unpinned.slice(Math.max(primaryCut - pinned.length, 0));
    const coreSize = Math.max(coreCut - primaryCut, 0);
    const core = remaining.slice(0, coreSize).map((item) => item.name);
    const edge = remaining.slice(coreSize).map((item) => item.name);

    return {
      primary: primary.length ? primary : sortedByWeight.slice(0, 1).map((item) => item.name),
      core,
      edge
    };
  }

  private splitColumnsForChen(columns: Entity['columns']): [Entity['columns'], Entity['columns']] {
    const left: Entity['columns'] = [];
    const right: Entity['columns'] = [];
    columns.forEach((column, index) => {
      if (index % 2 === 0) {
        left.push(column);
      } else {
        right.push(column);
      }
    });

    return [left, right];
  }

  private getChenCardinality(type: string): { from: string; to: string } {
    switch (type) {
      case 'one-to-one':
        return { from: '1', to: '1' };
      case 'one-to-many':
        return { from: '1', to: 'N' };
      case 'many-to-one':
        return { from: 'N', to: '1' };
      case 'many-to-many':
        return { from: 'N', to: 'M' };
      default:
        return { from: '1', to: 'N' };
    }
  }

  private orientChenRelationship(relationship: Relationship): {
    leftEntityNode: string;
    rightEntityNode: string;
    leftEntityLabel: string;
    rightEntityLabel: string;
    leftCardinality: string;
    rightCardinality: string;
  } {
    const cardinality = this.getChenCardinality(relationship.type);
    const fromName = relationship.from;
    const toName = relationship.to;
    const fromNode = this.chenEntityNodeId(fromName);
    const toNode = this.chenEntityNodeId(toName);

    if (fromName.localeCompare(toName) <= 0) {
      return {
        leftEntityNode: fromNode,
        rightEntityNode: toNode,
        leftEntityLabel: fromName,
        rightEntityLabel: toName,
        leftCardinality: cardinality.from,
        rightCardinality: cardinality.to
      };
    }

    return {
      leftEntityNode: toNode,
      rightEntityNode: fromNode,
      leftEntityLabel: toName,
      rightEntityLabel: fromName,
      leftCardinality: cardinality.to,
      rightCardinality: cardinality.from
    };
  }

  private chenEntityNodeId(entityName: string): string {
    return `E_${this.sanitizeNodeToken(entityName)}`;
  }

  private chenEntityAttrNodeId(entityName: string, attributeName: string): string {
    return `A_${this.sanitizeNodeToken(entityName)}_${this.sanitizeNodeToken(attributeName)}`;
  }

  private chenRelationshipNodeId(from: string, to: string, name: string): string {
    return `R_${this.sanitizeNodeToken(from)}_${this.sanitizeNodeToken(to)}_${this.sanitizeNodeToken(name)}`;
  }

  private chenRelationAttrNodeId(from: string, to: string, side: 'from' | 'to', attributeName: string): string {
    return `RA_${this.sanitizeNodeToken(from)}_${this.sanitizeNodeToken(to)}_${side}_${this.sanitizeNodeToken(attributeName)}`;
  }

  private sanitizeNodeToken(value: string): string {
    return value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'NODE';
  }

  private getPinnedPrimaryAnchors(customPinned: string[]): string[] {
    const fromEnv = (process.env.CHEN_PRIMARY_ANCHOR_PINNED || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const merged = customPinned.length > 0 ? customPinned : (fromEnv.length > 0 ? fromEnv : MermaidService.CHEN_PRIMARY_ANCHOR_PINNED);
    return [...new Set(merged)];
  }

  private normalizeDefaultValueForMermaid(defaultValue: string): string | null {
    const compact = defaultValue
      .trim()
      .replace(/^['"`]|['"`]$/g, '')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return compact.length > 0 ? compact.slice(0, 32) : null;
  }

  private normalizeForClassicER(
    entities: Entity[],
    relationships: Relationship[]
  ): { displayEntities: Entity[]; displayRelationships: Relationship[] } {
    const associativeTables = this.detectAssociativeTables(entities);
    if (associativeTables.length === 0) {
      return { displayEntities: entities, displayRelationships: relationships };
    }

    const associativeTableNames = new Set(associativeTables.map((entity) => entity.name));
    const manyToManyRelationships = this.buildManyToManyRelationships(associativeTables);
    const retainedRelationships = relationships.filter(
      (relationship) =>
        !associativeTableNames.has(relationship.from) && !associativeTableNames.has(relationship.to)
    );
    const dedupedRelationships = this.deduplicateRelationships([
      ...retainedRelationships,
      ...manyToManyRelationships
    ]);
    const displayEntities = entities.filter((entity) => !associativeTableNames.has(entity.name));

    return {
      displayEntities,
      displayRelationships: dedupedRelationships
    };
  }

  private detectAssociativeTables(entities: Entity[]): Entity[] {
    return entities.filter((entity) => {
      const columns = entity.columns || [];
      const foreignKeyColumns = columns.filter((column) => column.foreignKey);

      if (foreignKeyColumns.length < MermaidService.ASSOCIATIVE_TABLE_MIN_FOREIGN_KEYS) {
        return false;
      }

      const primaryKeys = new Set(columns.filter((column) => column.primaryKey).map((column) => column.name));
      if (primaryKeys.size === 0) {
        return false;
      }

      const foreignKeyNames = new Set(foreignKeyColumns.map((column) => column.name));
      const allPrimaryKeysAreForeignKeys = [...primaryKeys].every((name) => foreignKeyNames.has(name));
      const noNonKeyAttributes = columns.every((column) => primaryKeys.has(column.name) || !!column.foreignKey);

      return allPrimaryKeysAreForeignKeys && noNonKeyAttributes;
    });
  }

  private buildManyToManyRelationships(associativeTables: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    for (const table of associativeTables) {
      const foreignKeyColumns = table.columns.filter((column) => column.foreignKey);

      for (let i = 0; i < foreignKeyColumns.length; i += 1) {
        for (let j = i + 1; j < foreignKeyColumns.length; j += 1) {
          const left = foreignKeyColumns[i];
          const right = foreignKeyColumns[j];

          if (!left.foreignKey || !right.foreignKey) {
            continue;
          }

          relationships.push({
            id: uuidv4(),
            from: left.foreignKey.referencedTable,
            to: right.foreignKey.referencedTable,
            type: 'many-to-many',
            fromColumn: left.foreignKey.referencedColumn,
            toColumn: right.foreignKey.referencedColumn,
            name: `${table.name} association`
          });
        }
      }
    }

    return relationships;
  }

  private deduplicateRelationships(relationships: Relationship[]): Relationship[] {
    const unique = new Map<string, Relationship>();
    for (const relationship of relationships) {
      const key = this.buildRelationshipKey(relationship);
      if (!unique.has(key)) {
        unique.set(key, relationship);
      }
    }

    return [...unique.values()];
  }

  private buildRelationshipKey(relationship: Relationship): string {
    const ends = [relationship.from, relationship.to].sort().join('<->');
    return `${ends}|${relationship.type}|${relationship.name || ''}`;
  }

  private getCardinality(type: string, direction: 'from' | 'to'): string {
    switch (type) {
      case 'one-to-one':
        return '||';
      case 'one-to-many':
        return direction === 'from' ? '||' : 'o{';
      case 'many-to-many':
        return direction === 'from' ? 'o{' : '}o';
      default:
        return '--';
    }
  }

  private async generateSVG(
    entities: Entity[],
    relationships: Relationship[],
    config: MermaidConfig
  ): Promise<string> {
    const mermaidCode = this.generateDiagramCode(entities, relationships, config);
    const mermaid = await this.getMermaid();
    this.initMermaidConfig(mermaid, config);
    const { svg } = await mermaid.render(`er-diagram-${uuidv4()}`, mermaidCode);
    return svg;
  }

  async generateDiagram(
    entities: Entity[], 
    relationships: Relationship[], 
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): Promise<string> {
    try {
      return await this.generateSVG(entities, relationships, config);
    } catch (error) {
      throw new Error(`Failed to generate Mermaid diagram: ${error}`);
    }
  }

  async renderToPNG(
    entities: Entity[], 
    relationships: Relationship[], 
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): Promise<Buffer> {
    const svg = await this.generateSVG(entities, relationships, config);
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  async renderToPDF(
    entities: Entity[],
    relationships: Relationship[],
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): Promise<Buffer> {
    const svg = await this.generateSVG(entities, relationships, config);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const metadata = await sharp(png).metadata();
    const width = metadata.width ?? 1200;
    const height = metadata.height ?? 800;

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: [Math.max(width, 300), Math.max(height, 300)],
        margin: 0
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      SVGtoPDF(doc, svg, 0, 0, { width, height, assumePt: true });
      doc.end();
    });
  }
}

export const mermaidService = new MermaidService();
