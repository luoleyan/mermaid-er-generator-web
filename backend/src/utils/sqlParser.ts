import { v4 as uuidv4 } from 'uuid';
import type { Entity, Column, Relationship, SQLParseResult } from '../types';

export class SQLParser {
  private static extractTableName(statement: string): string | null {
    const createTableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/i);
    return createTableMatch ? createTableMatch[1] : null;
  }

  private static extractColumns(statement: string): Column[] {
    const columns: Column[] = [];
    
    // Extract content between parentheses
    const match = statement.match(/\(([\s\S]*)\)\s*;?\s*$/);
    if (!match) return columns;

    const content = match[1];
    
    // Split by comma, but handle nested parentheses
    const definitions: string[] = [];
    let current = '';
    let depth = 0;
    
    for (const char of content) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      
      if (char === ',' && depth === 0) {
        definitions.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      definitions.push(current.trim());
    }

    for (const def of definitions) {
      const trimmed = def.trim();
      if (!trimmed) continue;

      // Skip constraints (PRIMARY KEY, FOREIGN KEY, etc.)
      const upper = trimmed.toUpperCase();
      if (upper.startsWith('PRIMARY KEY') ||
          upper.startsWith('FOREIGN KEY') ||
          upper.startsWith('CONSTRAINT') ||
          upper.startsWith('UNIQUE') ||
          upper.startsWith('CHECK') ||
          upper.startsWith('INDEX')) {
        continue;
      }

      // Parse column definition
      // Pattern: name TYPE [(args)] [constraints]
      const colMatch = trimmed.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]+\))?)(.*)$/i);
      
      if (colMatch) {
        const name = colMatch[1];
        const type = colMatch[2].toUpperCase();
        const rest = colMatch[3].toUpperCase();
        
        const column: Column = {
          id: uuidv4(),
          name,
          type,
          nullable: !rest.includes('NOT NULL'),
          primaryKey: rest.includes('PRIMARY KEY')
        };

        columns.push(column);
      }
    }
    
    return columns;
  }

  private static extractRelationships(entities: Entity[], sql: string): Relationship[] {
    const relationships: Relationship[] = [];
    
    // Find all CREATE TABLE statements
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi;
    const tableMatches: Array<{ name: string; index: number }> = [];
    let match;
    
    while ((match = createTableRegex.exec(sql)) !== null) {
      tableMatches.push({ name: match[1], index: match.index });
    }
    
    // Process each table
    for (let i = 0; i < tableMatches.length; i++) {
      const tableName = tableMatches[i].name;
      const startIndex = tableMatches[i].index;
      const endIndex = i + 1 < tableMatches.length ? tableMatches[i + 1].index : sql.length;
      const tableSection = sql.substring(startIndex, endIndex);
      
      // Find the body between parentheses
      const bodyMatch = tableSection.match(/\(([\s\S]*)\)/);
      if (!bodyMatch) continue;
      
      const tableBody = bodyMatch[1];
      
      // Find FOREIGN KEY constraints - use simpler regex without global flag for iteration
      const fkRegex = /FOREIGN\s+KEY\s*\(\s*(\w+)\s*\)\s*REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/gi;
      let fkMatch;
      
      while ((fkMatch = fkRegex.exec(tableBody)) !== null) {
        const fromColumn = fkMatch[1];
        const toTable = fkMatch[2];
        const toColumn = fkMatch[3];
        
        const relationship: Relationship = {
          id: uuidv4(),
          from: toTable,  // Referenced table (parent)
          to: tableName,  // Current table (child)
          type: 'one-to-many',
          fromColumn: toColumn,
          toColumn: fromColumn
        };

        // Determine relationship type based on primary keys
        const parentEntity = entities.find(e => e.name === toTable);
        const childEntity = entities.find(e => e.name === tableName);
        
        if (parentEntity && childEntity) {
          const parentCol = parentEntity.columns.find(c => c.name === toColumn);
          const childCol = childEntity.columns.find(c => c.name === fromColumn);
          
          if (parentCol?.primaryKey && !childCol?.primaryKey) {
            relationship.type = 'one-to-many';
          } else if (!parentCol?.primaryKey && childCol?.primaryKey) {
            relationship.type = 'many-to-one';
          } else if (parentCol?.primaryKey && childCol?.primaryKey) {
            relationship.type = 'one-to-one';
          }
        }

        relationships.push(relationship);
      }
    }

    return relationships;
  }

  static parseSQL(sql: string): SQLParseResult {
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];
    const errors: string[] = [];

    if (!sql.trim()) {
      return { entities, relationships, errors };
    }

    // Normalize SQL - remove comments but preserve structure
    const normalizedSQL = sql
      .replace(/--[^\n]*\n/g, '\n') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .trim();

    // Split into statements (handle semicolons inside strings)
    const statements: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < normalizedSQL.length; i++) {
      const char = normalizedSQL[i];
      const prevChar = i > 0 ? normalizedSQL[i - 1] : '';
      
      if (!inString && (char === "'" || char === '"' || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }
      
      if (!inString && char === ';') {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      statements.push(current.trim());
    }

    // Parse each statement
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      
      if (trimmedStatement.toUpperCase().startsWith('CREATE TABLE')) {
        try {
          const tableName = this.extractTableName(trimmedStatement);
          
          if (tableName) {
            // Need to find the complete statement including the closing parenthesis
            const columns = this.extractColumns(trimmedStatement);
            
            const entity: Entity = {
              id: uuidv4(),
              name: tableName,
              columns,
              relationships: []
            };

            entities.push(entity);
          } else {
            errors.push(`Invalid CREATE TABLE statement: ${trimmedStatement.substring(0, 100)}...`);
          }
        } catch (error) {
          errors.push(`Error parsing statement: ${error}`);
        }
      }
    }

    // Extract relationships after all entities are parsed
    // Use original sql (with comments removed) for relationship extraction
    const sqlForRelationships = sql
      .replace(/--[^\n]*\n/g, '\n') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    relationships.push(...this.extractRelationships(entities, sqlForRelationships));

    return {
      entities,
      relationships,
      errors
    };
  }
}
