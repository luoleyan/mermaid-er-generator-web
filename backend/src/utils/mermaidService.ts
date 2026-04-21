import { v4 as uuidv4 } from 'uuid';
import { Entity, Relationship } from '../types';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';

export interface MermaidConfig {
  theme: string;
  securityLevel: 'loose' | 'strict' | 'antiscript';
  fontFamily: string;
  viewMode?: 'classic' | 'physical' | 'chen';
  chenPinnedEntities?: string[];
  exportOptions?: {
    schemaName?: string;
    includeTitleBar?: boolean;
    imageScale?: 1 | 2 | 3;
    exportedAt?: Date;
    projectName?: string;
    version?: string;
    includeProjectMeta?: boolean;
    pdfPageStrategy?: 'original' | 'a4-landscape';
    titleTemplateLocale?: 'zh' | 'en';
    titleFieldOrder?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>;
    showUTC?: boolean;
  };
}

type MermaidInstance = (typeof import('mermaid'))['default'];

export class MermaidService {
  private mermaid: MermaidInstance | null = null;

  /** Serializes server-side mermaid renders; each run temporarily installs JSDOM globals. */
  private static browserGlobalsChain: Promise<void> = Promise.resolve();

  private static readonly ASSOCIATIVE_TABLE_MIN_FOREIGN_KEYS = 2;
  private static readonly CHEN_PRIMARY_ANCHOR_PINNED = ['USERS', 'ARTICLES'];

  /**
   * Mermaid's render path expects browser globals (`document`, etc.). Other concurrent
   * requests must not interleave mutating those globals, so runs are queued.
   */
  private async runWithBrowserGlobals<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = MermaidService.browserGlobalsChain;
    MermaidService.browserGlobalsChain = ready;
    await prev;

    const g = globalThis as unknown as Record<string, unknown>;
    const keys = [
      'window',
      'document',
      'navigator',
      'SVGElement',
      'HTMLElement',
      'Element',
      'Node'
    ] as const;
    const previousDescriptors = new Map<string, PropertyDescriptor | undefined>();
    for (const k of keys) {
      previousDescriptors.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
    }
    const install = (name: string, value: unknown) => {
      Object.defineProperty(globalThis, name, {
        value,
        configurable: true,
        writable: true,
        enumerable: true
      });
    };
    try {
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        pretendToBeVisual: true,
        url: 'http://localhost/'
      });
      const w = dom.window;
      this.patchJsdomWindowForMermaid(w);
      install('window', w);
      install('document', w.document);
      install('navigator', w.navigator);
      install('SVGElement', w.SVGElement);
      install('HTMLElement', w.HTMLElement);
      install('Element', w.Element);
      install('Node', w.Node);
      return await fn();
    } finally {
      for (const k of keys) {
        const prev = previousDescriptors.get(k);
        if (prev) {
          Object.defineProperty(globalThis, k, prev);
        } else {
          delete g[k];
        }
      }
      release();
    }
  }

  /** JSDOM does not implement SVG text layout APIs Mermaid's ER renderer relies on. */
  private patchJsdomWindowForMermaid(w: import('jsdom').DOMWindow): void {
    const ns = 'http://www.w3.org/2000/svg';
    const root = w.document.createElementNS(ns, 'svg');
    const label = w.document.createElementNS(ns, 'text');
    root.appendChild(label);
    w.document.body.appendChild(root);

    const rect = (x: number, y: number, width: number, height: number): DOMRect => {
      if (typeof w.DOMRect === 'function') {
        return new w.DOMRect(x, y, width, height);
      }
      const bottom = y + height;
      const right = x + width;
      return {
        x,
        y,
        width,
        height,
        top: y,
        left: x,
        bottom,
        right,
        toJSON() {
          return { x, y, width, height, top: y, left: x, bottom, right };
        }
      } as DOMRect;
    };

    // JSDOM often implements `<text>` / `<g>` as plain `SVGElement` (not `SVGGraphicsElement`),
    // so only patching SVGGraphicsElement leaves `getBBox` missing on those nodes.
    const svgElementProto = w.SVGElement.prototype as unknown as {
      getBBox?: () => DOMRect;
      getComputedTextLength?: () => number;
    };
    svgElementProto.getBBox = function getBBox() {
      return rect(0, 0, 200, 48);
    };
    svgElementProto.getComputedTextLength = function getComputedTextLength(this: SVGElement) {
      const text = this.textContent ?? '';
      return Math.max(1, text.length * 7.2);
    };
    if (w.SVGSVGElement) {
      w.SVGSVGElement.prototype.getBBox = function getBBox() {
        return rect(0, 0, 1200, 800);
      };
    }
  }

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
    const profile = this.getERViewProfile(viewMode);
    let code = 'erDiagram\n';
    
    // Generate entity definitions
    for (const entity of displayEntities) {
      code += `  ${entity.name} {\n`;
      
      for (const column of entity.columns) {
        const normalizedType = profile.includePhysicalDetails
          ? (column.type || 'string')
          : this.toConceptualType(column.type);
        let columnDef = `    ${normalizedType} ${column.name}`;
        
        if (column.primaryKey) {
          columnDef += ' PK';
        }
        
        if (column.foreignKey) {
          columnDef += ' FK';
        }

        if (profile.includePhysicalDetails && column.unique && !column.primaryKey) {
          columnDef += ' UK';
        }
        
        if (profile.includePhysicalDetails && !column.nullable && !column.primaryKey) {
          columnDef += ' NOT NULL';
        }

        if (profile.includePhysicalDetails && column.defaultValue) {
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
      const cardinality = this.getERCardinality(relationship.type);
      const relationName = this.getRelationshipLabel(relationship, profile.includePhysicalDetails);
      code += `  ${relationship.from} ${cardinality.left}--${cardinality.right} ${relationship.to} : "${relationName}"\n`;
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
    const { displayEntities, displayRelationships } = this.normalizeForClassicER(entities, relationships);
    const columns = this.buildChenEntityAnchorColumns(displayEntities, displayRelationships, chenPinnedEntities);
    const rankMap = new Map<string, number>();
    for (const entity of columns.primary) rankMap.set(entity, 0);
    for (const entity of columns.core) rankMap.set(entity, 1);
    for (const entity of columns.edge) rankMap.set(entity, 2);
    const chenAttributes = this.buildChenAttributes(displayEntities, displayRelationships);
    const lines: string[] = ['flowchart LR'];

    for (const entity of displayEntities) {
      const entityNode = this.chenEntityNodeId(entity.name);
      lines.push(`  ${entityNode}["${entity.name}"]`);
      const [leftColumns, rightColumns] = this.splitColumnsForChen(chenAttributes.get(entity.name) || []);

      for (const column of [...leftColumns, ...rightColumns]) {
        const attrNode = this.chenEntityAttrNodeId(entity.name, column.name);
        const attrLabel = column.primaryKey ? `<u>${column.name}</u>` : column.name;
        lines.push(`  ${attrNode}(("${attrLabel}"))`);
        lines.push(`  ${entityNode} --- ${attrNode}`);
      }
    }

    const sortedRelationships = [...displayRelationships].sort((a, b) =>
      `${a.from}|${a.to}|${a.name || ''}`.localeCompare(`${b.from}|${b.to}|${b.name || ''}`)
    );

    for (const relationship of sortedRelationships) {
      const relationshipLabel = relationship.name || `${relationship.from}_to_${relationship.to}`;
      const relationshipNode = this.chenRelationshipNodeId(
        relationship.from,
        relationship.to,
        relationshipLabel
      );
      const oriented = this.orientChenRelationship(relationship, rankMap);

      // Relationship in the middle with strict Chen semantics:
      // entity-relationship links + cardinality only.
      lines.push(`  ${relationshipNode}{"${relationshipLabel}"}`);

      lines.push(`  ${oriented.leftEntityNode} -- "${oriented.leftCardinality}" --- ${relationshipNode}`);
      lines.push(`  ${relationshipNode} -- "${oriented.rightCardinality}" --- ${oriented.rightEntityNode}`);
    }

    return lines.join('\n');
  }

  private buildChenAttributes(entities: Entity[], relationships: Relationship[]): Map<string, Entity['columns']> {
    const fkColumnNames = new Map<string, Set<string>>();
    for (const entity of entities) {
      fkColumnNames.set(entity.name, new Set());
    }
    for (const relationship of relationships) {
      if (relationship.fromColumn) {
        fkColumnNames.get(relationship.from)?.add(relationship.fromColumn);
      }
      if (relationship.toColumn) {
        fkColumnNames.get(relationship.to)?.add(relationship.toColumn);
      }
    }

    const result = new Map<string, Entity['columns']>();
    for (const entity of entities) {
      const suppressedFk = fkColumnNames.get(entity.name) || new Set<string>();
      const filtered = entity.columns.filter((column) => !suppressedFk.has(column.name));
      result.set(
        entity.name,
        filtered.sort((a, b) => {
          if (!!a.primaryKey !== !!b.primaryKey) return a.primaryKey ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
      );
    }
    return result;
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

  private orientChenRelationship(
    relationship: Relationship,
    rankMap: Map<string, number>
  ): {
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

    const fromRank = rankMap.get(fromName) ?? 1;
    const toRank = rankMap.get(toName) ?? 1;
    const keepFromLeft = fromRank < toRank || (fromRank === toRank && fromName.localeCompare(toName) <= 0);

    if (keepFromLeft) {
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

  private getERCardinality(type: string): { left: string; right: string } {
    switch (type) {
      case 'one-to-one':
        return { left: '||', right: '||' };
      case 'one-to-many':
        return { left: '||', right: 'o{' };
      case 'many-to-one':
        return { left: '}o', right: '||' };
      case 'many-to-many':
        return { left: '}o', right: 'o{' };
      default:
        return { left: '||', right: 'o{' };
    }
  }

  private getERViewProfile(viewMode: 'classic' | 'physical' | 'chen'): { includePhysicalDetails: boolean } {
    if (viewMode === 'physical') {
      return { includePhysicalDetails: true };
    }
    return { includePhysicalDetails: false };
  }

  private getRelationshipLabel(relationship: Relationship, includePhysicalDetails: boolean): string {
    if (relationship.name && relationship.name.trim().length > 0) {
      return relationship.name;
    }
    if (includePhysicalDetails) {
      return `${relationship.to}.${relationship.toColumn || '?'} -> ${relationship.from}.${relationship.fromColumn || '?'}`;
    }
    return `${relationship.from} to ${relationship.to}`;
  }

  private toConceptualType(physicalType?: string): string {
    const token = (physicalType || '').toLowerCase();
    if (/int|numeric|decimal|float|double|real|serial/.test(token)) return 'number';
    if (/bool/.test(token)) return 'boolean';
    if (/date|time|year/.test(token)) return 'datetime';
    if (/char|text|json|uuid|enum|set/.test(token)) return 'string';
    return 'string';
  }

  private async generateSVG(
    entities: Entity[],
    relationships: Relationship[],
    config: MermaidConfig
  ): Promise<string> {
    const mermaidCode = this.generateDiagramCode(entities, relationships, config);
    return this.renderMermaidCodeToSVG(
      mermaidCode,
      config,
      config.exportOptions?.schemaName || this.inferSchemaName(entities)
    );
  }

  private async renderMermaidCodeToSVG(
    mermaidCode: string,
    config: MermaidConfig,
    schemaNameForTitle = 'default'
  ): Promise<string> {
    const { svg } = await this.runWithBrowserGlobals(async () => {
      const mermaid = await this.getMermaid();
      this.initMermaidConfig(mermaid, config);
      const diagramId = `er-diagram-${uuidv4()}`;
      return mermaid.render(diagramId, mermaidCode);
    });
    const includeTitleBar = config.exportOptions?.includeTitleBar === true;
    if (!includeTitleBar) {
      return svg;
    }

    const title = this.buildExportTitle(
      config.viewMode || 'classic',
      config.exportOptions?.schemaName || schemaNameForTitle,
      config.exportOptions?.exportedAt || new Date(),
      config.exportOptions?.includeProjectMeta === true
        ? this.buildProjectMeta(config.exportOptions?.projectName, config.exportOptions?.version)
        : undefined,
      this.buildTitleTemplateOptions(
        config.exportOptions?.titleTemplateLocale,
        config.exportOptions?.titleFieldOrder,
        config.exportOptions?.showUTC
      )
    );
    return this.withExportTitleBar(svg, title);
  }

  async renderCodeToSVG(
    mermaidCode: string,
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): Promise<string> {
    return this.renderMermaidCodeToSVG(mermaidCode, config, config.exportOptions?.schemaName || 'default');
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
    const scale = this.normalizeExportScale(config.exportOptions?.imageScale);
    return sharp(Buffer.from(svg), { density: 96 * scale }).png().toBuffer();
  }

  async renderCodeToPNG(
    mermaidCode: string,
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): Promise<Buffer> {
    const svg = await this.renderCodeToSVG(mermaidCode, config);
    const scale = this.normalizeExportScale(config.exportOptions?.imageScale);
    return sharp(Buffer.from(svg), { density: 96 * scale }).png().toBuffer();
  }

  async renderToPDF(
    entities: Entity[],
    relationships: Relationship[],
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): Promise<Buffer> {
    const svg = await this.generateSVG(entities, relationships, config);
    return this.renderSVGToPDF(svg, config);
  }

  async renderCodeToPDF(
    mermaidCode: string,
    config: MermaidConfig = { theme: 'default', securityLevel: 'loose', fontFamily: 'sans-serif', viewMode: 'classic' }
  ): Promise<Buffer> {
    const svg = await this.renderCodeToSVG(mermaidCode, config);
    return this.renderSVGToPDF(svg, config);
  }

  private async renderSVGToPDF(svg: string, config: MermaidConfig): Promise<Buffer> {
    const scale = this.normalizeExportScale(config.exportOptions?.imageScale);
    const basePng = await sharp(Buffer.from(svg), { density: 96 }).png().toBuffer();
    const hiResPng = await sharp(Buffer.from(svg), { density: 96 * scale }).png().toBuffer();
    const metadata = await sharp(basePng).metadata();
    const width = metadata.width ?? 1200;
    const height = metadata.height ?? 800;
    const pdfPageStrategy = config.exportOptions?.pdfPageStrategy || 'original';

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc =
        pdfPageStrategy === 'a4-landscape'
          ? new PDFDocument({
              size: 'A4',
              layout: 'landscape',
              margin: 24
            })
          : new PDFDocument({
              size: [Math.max(width, 300), Math.max(height, 300)],
              margin: 0
            });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (pdfPageStrategy === 'a4-landscape') {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const maxWidth = pageWidth - 48;
        const maxHeight = pageHeight - 48;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        const drawWidth = Math.max(1, Math.round(width * ratio));
        const drawHeight = Math.max(1, Math.round(height * ratio));
        const x = Math.round((pageWidth - drawWidth) / 2);
        const y = Math.round((pageHeight - drawHeight) / 2);
        doc.image(hiResPng, x, y, { width: drawWidth, height: drawHeight });
      } else {
        doc.image(hiResPng, 0, 0, { width, height });
      }
      doc.end();
    });
  }

  private normalizeExportScale(scale?: number): 1 | 2 | 3 {
    if (scale === 2 || scale === 3) return scale;
    return 1;
  }

  private inferSchemaName(entities: Entity[]): string {
    if (entities.length === 0) return 'default';
    const prefixes = new Set<string>();
    for (const entity of entities) {
      const parts = entity.name.split('.');
      if (parts.length > 1) {
        prefixes.add(parts[0]);
      }
    }
    if (prefixes.size === 1) {
      return [...prefixes][0];
    }
    return 'default';
  }

  private buildExportTitle(
    viewMode: 'classic' | 'physical' | 'chen',
    schemaName: string,
    exportedAt: Date,
    projectMeta?: {
      projectName?: string;
      version?: string;
    },
    titleTemplateOptions?: {
      locale?: 'zh' | 'en';
      fieldOrder?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>;
      showUTC?: boolean;
    }
  ): string {
    const locale = titleTemplateOptions?.locale === 'zh' ? 'zh' : 'en';
    const showUTC = titleTemplateOptions?.showUTC !== false;
    const modeLabel =
      viewMode === 'classic' ? (locale === 'zh' ? '经典 ER' : 'Classic ER')
      : viewMode === 'physical' ? (locale === 'zh' ? '物理 ER' : 'Physical ER')
      : (locale === 'zh' ? 'Chen ER' : 'Chen ER');
    const timestamp = showUTC
      ? `${exportedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`
      : exportedAt.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
    const labels = locale === 'zh'
      ? { mode: '模式', schema: 'Schema', exported: '导出时间', project: '项目', version: '版本' }
      : { mode: 'mode', schema: 'schema', exported: 'exported', project: 'project', version: 'version' };
    const fieldOrder = this.normalizeTitleFieldOrder(titleTemplateOptions?.fieldOrder);
    const valueByField: Record<'mode' | 'schema' | 'exported' | 'project' | 'version', string | null> = {
      mode: modeLabel,
      schema: schemaName || 'default',
      exported: timestamp,
      project: projectMeta?.projectName?.trim() || null,
      version: projectMeta?.version?.trim() || null
    };

    const parts: string[] = [];
    for (const field of fieldOrder) {
      const value = valueByField[field];
      if (!value) continue;
      parts.push(`${labels[field]}: ${value}`);
    }
    return parts.join(' | ');
  }

  private normalizeTitleFieldOrder(
    fields?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>
  ): Array<'mode' | 'schema' | 'exported' | 'project' | 'version'> {
    const defaults: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'> = ['mode', 'schema', 'exported', 'project', 'version'];
    if (!Array.isArray(fields) || fields.length === 0) {
      return defaults;
    }
    const allowed = new Set(defaults);
    const normalized = fields.filter((item): item is 'mode' | 'schema' | 'exported' | 'project' | 'version' => allowed.has(item));
    const unique = [...new Set(normalized)];
    for (const item of defaults) {
      if (!unique.includes(item)) unique.push(item);
    }
    return unique;
  }

  private buildTitleTemplateOptions(
    locale?: 'zh' | 'en',
    fieldOrder?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>,
    showUTC?: boolean
  ): {
    locale?: 'zh' | 'en';
    fieldOrder?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>;
    showUTC?: boolean;
  } | undefined {
    const options: {
      locale?: 'zh' | 'en';
      fieldOrder?: Array<'mode' | 'schema' | 'exported' | 'project' | 'version'>;
      showUTC?: boolean;
    } = {};

    if (locale) {
      options.locale = locale;
    }
    if (fieldOrder && fieldOrder.length > 0) {
      options.fieldOrder = fieldOrder;
    }
    if (typeof showUTC === 'boolean') {
      options.showUTC = showUTC;
    }

    return Object.keys(options).length > 0 ? options : undefined;
  }

  private buildProjectMeta(
    projectName?: string,
    version?: string
  ): { projectName?: string; version?: string } | undefined {
    const meta: { projectName?: string; version?: string } = {};
    const normalizedProject = projectName?.trim();
    const normalizedVersion = version?.trim();

    if (normalizedProject) {
      meta.projectName = normalizedProject;
    }
    if (normalizedVersion) {
      meta.version = normalizedVersion;
    }

    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private withExportTitleBar(svg: string, title: string): string {
    const openTagMatch = svg.match(/^<svg\b[^>]*>/);
    if (!openTagMatch) return svg;

    const openTag = openTagMatch[0];
    const closeTag = '</svg>';
    const closeIndex = svg.lastIndexOf(closeTag);
    if (closeIndex < 0) return svg;

    const inner = svg.slice(openTag.length, closeIndex);
    const width = this.extractSvgDimension(svg, 'width', 1200);
    const height = this.extractSvgDimension(svg, 'height', 800);
    const headerHeight = 56;
    const escapedTitle = this.escapeXml(title);

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + headerHeight}" viewBox="0 0 ${width} ${height + headerHeight}">`,
      '  <defs>',
      '    <linearGradient id="exportTitleBarGradient" x1="0" y1="0" x2="1" y2="0">',
      '      <stop offset="0%" stop-color="#f6f9ff"/>',
      '      <stop offset="100%" stop-color="#edf3ff"/>',
      '    </linearGradient>',
      '  </defs>',
      `  <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="url(#exportTitleBarGradient)"/>`,
      `  <line x1="0" y1="${headerHeight}" x2="${width}" y2="${headerHeight}" stroke="#d2ddf2" stroke-width="1"/>`,
      `  <text x="18" y="34" fill="#1f3f73" font-size="16" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">${escapedTitle}</text>`,
      `  <g transform="translate(0 ${headerHeight})">`,
      inner,
      '  </g>',
      '</svg>'
    ].join('\n');
  }

  private extractSvgDimension(svg: string, attr: 'width' | 'height', fallback: number): number {
    const attrMatch = svg.match(new RegExp(`${attr}="([\\d.]+)(?:px)?"`));
    if (attrMatch) {
      return Math.max(1, Math.round(Number(attrMatch[1])));
    }

    const viewBoxMatch = svg.match(/viewBox="([\d.\s-]+)"/);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/\s+/).map((part) => Number(part));
      if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
        return Math.max(1, Math.round(attr === 'width' ? parts[2] : parts[3]));
      }
    }

    return fallback;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const mermaidService = new MermaidService();
