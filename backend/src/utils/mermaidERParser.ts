import { v4 as uuidv4 } from 'uuid';
import type { Column, Entity, Relationship } from '../types';

export class MermaidERParser {
  static parse(code: string): { entities: Entity[]; relationships: Relationship[] } {
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];
    const lines = code.split('\n');
    let currentEntity: Entity | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('%%') || line === 'erDiagram') continue;

      const entityStart = line.match(/^([A-Za-z0-9_]+)\s*\{$/);
      if (entityStart) {
        currentEntity = {
          id: uuidv4(),
          name: entityStart[1],
          columns: [],
          relationships: []
        };
        entities.push(currentEntity);
        continue;
      }

      if (line === '}') {
        currentEntity = null;
        continue;
      }

      if (currentEntity) {
        const column = this.parseColumn(line);
        if (column) {
          currentEntity.columns.push(column);
        }
        continue;
      }

      const relationship = this.parseRelationship(line);
      if (relationship) {
        relationships.push(relationship);
      }
    }

    return { entities, relationships };
  }

  private static parseColumn(line: string): Column | null {
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    const [type, name, ...flags] = parts;
    const upperFlags = flags.map((token) => token.toUpperCase());

    return {
      id: uuidv4(),
      type,
      name,
      primaryKey: upperFlags.includes('PK'),
      unique: upperFlags.includes('UK'),
      nullable: !upperFlags.includes('NOT') && !upperFlags.includes('NOTNULL')
    };
  }

  private static parseRelationship(line: string): Relationship | null {
    const relMatch = line.match(/^([A-Za-z0-9_]+)\s+([|}{o]{1,2})--([|}{o]{1,2})\s+([A-Za-z0-9_]+)(?:\s*:\s*"?(.*?)"?)?$/);
    if (!relMatch) return null;

    const [, from, leftCard, rightCard, to, name] = relMatch;

    const relationship: Relationship = {
      id: uuidv4(),
      from,
      to,
      type: this.toRelationshipType(leftCard, rightCard)
    };
    if (name) {
      relationship.name = name;
    }

    return relationship;
  }

  private static toRelationshipType(left: string, right: string): string {
    if (left === '||' && right === '||') return 'one-to-one';
    if (left === '||' && (right === 'o{' || right === '|{')) return 'one-to-many';
    if ((left === 'o{' || left === '}o' || left === '|{') && right === '||') return 'many-to-one';
    if ((left === 'o{' || left === '}o' || left === '|{') && (right === 'o{' || right === '}o' || right === '|{')) {
      return 'many-to-many';
    }
    return 'one-to-many';
  }
}
