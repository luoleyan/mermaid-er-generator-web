import { Attribute, Entity, Relationship, RelationshipType, ParseResult } from '../../../../shared/types';

export class SQLParserService {
  private entities: Record<string, Entity> = {};
  private relationships: Relationship[] = [];

  parse(sqlDDL: string): ParseResult {
    this.entities = {};
    this.relationships = [];

    const cleanSql = this.cleanSql(sqlDDL);
    const createTablePositions = this.findCreateTablePositions(cleanSql);

    for (let i = 0; i < createTablePositions.length; i++) {
      const startPos = createTablePositions[i];
      const endPos = i + 1 < createTablePositions.length ? 
        createTablePositions[i + 1] : cleanSql.length;

      const statement = cleanSql.slice(startPos, endPos).trim();
      this.parseCreateTable(statement);
    }

    this.analyzeRelationships();

    return {
      entities: this.entities,
      relationships: this.relationships,
    };
  }

  private cleanSql(sqlDDL: string): string {
    let clean = sqlDDL.replace(/\s+/g, ' ').trim();
    clean = clean.replace(/`/g, '"').replace(/\[/g, '"').replace(/\]/g, '"');
    clean = clean.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return clean;
  }

  private findCreateTablePositions(sql: string): number[] {
    const positions: number[] = [];
    const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi;
    
    let match;
    while ((match = regex.exec(sql)) !== null) {
      positions.push(match.index);
    }
    
    return positions;
  }

  private parseCreateTable(statement: string): void {
    const tableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i);
    if (!tableMatch) return;

    const tableName = tableMatch[1].replace(/['"`]/g, '').trim();

    const parenStart = statement.indexOf('(', tableMatch[0].length);
    if (parenStart === -1) return;

    const parenEnd = this.findMatchingParenthesis(statement, parenStart);
    if (parenEnd === -1) return;

    const tableBody = statement.slice(parenStart + 1, parenEnd).trim();
    const tableRemainder = statement.slice(parenEnd + 1).trim();

    const commentMatch = tableRemainder.match(/COMMENT\s+['"]([^'"]+)['"]/i);
    const tableComment = commentMatch ? commentMatch[1] : undefined;

    const entity: Entity = { 
      name: tableName, 
      attributes: [], 
      comment: tableComment 
    };

    this.parseTableBody(tableBody, entity);
    this.entities[tableName] = entity;
  }

  private findMatchingParenthesis(str: string, start: number): number {
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  private parseTableBody(tableBody: string, entity: Entity): void {
    const fieldDefinitions = this.splitFieldDefinitions(tableBody);
    const foreignKeyConstraints: string[] = [];

    for (const fieldDef of fieldDefinitions) {
      const trimmed = fieldDef.trim();
      if (!trimmed) continue;

      if (this.isConstraintLine(trimmed)) {
        if (/FOREIGN\s+KEY/i.test(trimmed)) {
          foreignKeyConstraints.push(trimmed);
        }
        continue;
      }

      const attribute = this.parseFieldDefinition(trimmed);
      if (attribute) {
        entity.attributes.push(attribute);
      }
    }

    for (const fkConstraint of foreignKeyConstraints) {
      this.parseForeignKeyConstraint(fkConstraint, entity);
    }
  }

  private splitFieldDefinitions(tableBody: string): string[] {
    const definitions: string[] = [];
    let current: string[] = [];
    let parenDepth = 0;

    for (const char of tableBody) {
      if (char === '(') {
        parenDepth++;
        current.push(char);
      } else if (char === ')') {
        parenDepth--;
        current.push(char);
      } else if (char === ',' && parenDepth === 0) {
        definitions.push(current.join('').trim());
        current = [];
      } else {
        current.push(char);
      }
    }

    if (current.length > 0) {
      definitions.push(current.join('').trim());
    }

    return definitions;
  }

  private isConstraintLine(line: string): boolean {
    const upper = line.toUpperCase();
    return upper.startsWith('PRIMARY KEY') ||
           upper.startsWith('FOREIGN KEY') ||
           upper.startsWith('UNIQUE') ||
           upper.startsWith('CHECK') ||
           upper.startsWith('CONSTRAINT') ||
           upper.startsWith('INDEX');
  }

  private parseFieldDefinition(fieldDef: string): Attribute | null {
    const parts = fieldDef.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const name = parts[0].replace(/['"`\[\]]/g, '');
    const dataTypeParts: string[] = [];
    let i = 1;
    
    while (i < parts.length) {
      const part = parts[i];
      dataTypeParts.push(part);
      if (part.includes('(') && !part.includes(')')) {
        i++;
        while (i < parts.length && !parts[i].includes(')')) {
          dataTypeParts.push(parts[i]);
          i++;
        }
        if (i < parts.length) {
          dataTypeParts.push(parts[i]);
        }
      }
      i++;
      if (!parts[i] || parts[i].toUpperCase().match(/^(NOT|DEFAULT|COMMENT|PRIMARY|UNIQUE|CHECK|REFERENCES|FOREIGN)/)) {
        break;
      }
    }

    const data_type = dataTypeParts.join('').toUpperCase();
    const attribute: Attribute = { 
      name, 
      data_type,
      is_primary_key: false,
      is_foreign_key: false,
      is_nullable: true
    };

    const definitionUpper = fieldDef.toUpperCase();
    
    if (definitionUpper.includes('PRIMARY KEY')) {
      attribute.is_primary_key = true;
      attribute.is_nullable = false;
    }
    
    if (definitionUpper.includes('NOT NULL')) {
      attribute.is_nullable = false;
    }

    const defaultMatch = fieldDef.match(/DEFAULT\s+([^\s,]+)/i);
    if (defaultMatch) {
      attribute.default_value = defaultMatch[1].replace(/['"]/g, '');
    }
    
    const commentMatch = fieldDef.match(/COMMENT\s+['"]([^'"]+)['"]/i);
    if (commentMatch) {
      attribute.comment = commentMatch[1];
    }

    return attribute;
  }

  private parseForeignKeyConstraint(constraint: string, entity: Entity): void {
    const pattern = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i;
    const match = constraint.match(pattern);
    
    if (match) {
      const localColumn = match[1].replace(/['"`\[\]]/g, '').trim();
      const refTable = match[2].replace(/['"`\[\]]/g, '').trim();
      const refColumn = match[3].replace(/['"`\[\]]/g, '').trim();
      
      for (const attribute of entity.attributes) {
        if (attribute.name.toLowerCase() === localColumn.toLowerCase()) {
          attribute.is_foreign_key = true;
          attribute.references = `${refTable}.${refColumn}`;
          break;
        }
      }
    }
  }

  private analyzeRelationships(): void {
    for (const entityName in this.entities) {
      const entity = this.entities[entityName];
      const foreignKeys = entity.attributes.filter(attr => attr.is_foreign_key);

      for (const fk of foreignKeys) {
        if (fk.references) {
          const [refTable, refColumn] = fk.references.split('.');
          
          let relationshipType = RelationshipType.ONE_TO_MANY;
          
          if (fk.is_primary_key) {
            relationshipType = RelationshipType.ONE_TO_ONE;
          }
          
          const relationship: Relationship = {
            from_entity: entityName,
            from_attribute: fk.name,
            to_entity: refTable,
            to_attribute: refColumn,
            relationship_type: relationshipType,
          };

          this.relationships.push(relationship);
        }
      }
    }
  }
}

export const sqlParserService = new SQLParserService();
