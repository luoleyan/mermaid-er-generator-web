import { v4 as uuidv4 } from 'uuid';
import type { Entity, Column, Relationship, SQLParseResult } from '../types';

export class SQLParser {
  private static extractTableName(statement: string): string | null {
    const createTableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i);
    return createTableMatch ? createTableMatch[1] : null;
  }

  private static extractColumns(statement: string): Column[] {
    const columns: Column[] = [];
    const columnsMatch = statement.match(/\(([\s\S]*?)\)/);
    
    if (!columnsMatch) return columns;

    const columnDefinitions = columnsMatch[1].split(',').map(def => def.trim());
    
    for (let i = 0; i < columnDefinitions.length; i++) {
      const columnDef = columnDefinitions[i];
      
      // Skip constraints
      if (columnDef.toUpperCase().includes('PRIMARY KEY') ||
          columnDef.toUpperCase().includes('FOREIGN KEY') ||
          columnDef.toUpperCase().includes('UNIQUE') ||
          columnDef.toUpperCase().includes('CHECK')) {
        continue;
      }

      const columnMatch = columnDef.match(/^`?(\w+)`?\s+([^,\s]+(?:\([^)]+\))?)(.*)$/i);
      
      if (columnMatch) {
        const name = columnMatch[1];
        const type = columnMatch[2].toUpperCase();
        const constraints = columnMatch[3].toUpperCase();
        
        const column: Column = {
          id: uuidv4(),
          name,
          type,
          nullable: !constraints.includes('NOT NULL'),
          primaryKey: constraints.includes('PRIMARY KEY')
        };

        // Extract foreign key information
        const fkMatch = columnDef.match(/FOREIGN\s+KEY\s+\(\s*`?(\w+)`?\s*\)\s+REFERENCES\s+`?(\w+)`?\s*\(\s*`?(\w+)`?\s*\)/i);
        if (fkMatch) {
          column.foreignKey = {
            referencedTable: fkMatch[2],
            referencedColumn: fkMatch[3]
          };
        }

        columns.push(column);
      }
    }
    
    return columns;
  }

  private static extractRelationships(entities: Entity[], sql: string): Relationship[] {
    const relationships: Relationship[] = [];
    const foreignKeys: Array<{
      fromTable: string;
      fromColumn: string;
      toTable: string;
      toColumn: string;
    }> = [];

    // Find all foreign key definitions
    const fkRegex = /FOREIGN\s+KEY\s+\(\s*`?(\w+)`?\s*\)\s+REFERENCES\s+`?(\w+)`?\s*\(\s*`?(\w+)`?\s*\)/gi;
    let match;
    
    while ((match = fkRegex.exec(sql)) !== null) {
      foreignKeys.push({
        fromTable: match[2], // referenced table (parent)
        fromColumn: match[3], // referenced column
        toTable: match[0].match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i)?.[1] || '', // current table
        toColumn: match[1] // current column
      });
    }

    // Create relationships from foreign keys
    for (const fk of foreignKeys) {
      const fromEntity = entities.find(e => e.name === fk.fromTable);
      const toEntity = entities.find(e => e.name === fk.toTable);
      
      if (fromEntity && toEntity) {
        const relationship: Relationship = {
          id: uuidv4(),
          from: fk.fromTable,
          to: fk.toTable,
          type: 'one-to-many', // Default assumption
          fromColumn: fk.fromColumn,
          toColumn: fk.toColumn
        };

        // Determine relationship type
        const fromColumn = fromEntity.columns.find(c => c.name === fk.fromColumn);
        const toColumn = toEntity.columns.find(c => c.name === fk.toColumn);
        
        if (fromColumn && toColumn) {
          if (fromColumn.primaryKey && !toColumn.primaryKey) {
            relationship.type = 'one-to-many';
          } else if (!fromColumn.primaryKey && toColumn.primaryKey) {
            relationship.type = 'many-to-one';
          } else {
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

    // Normalize SQL
    const normalizedSQL = sql
      .replace(/--.*$/gm, '') // Remove comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Split into statements
    const statements = normalizedSQL.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      
      if (trimmedStatement.toUpperCase().startsWith('CREATE TABLE')) {
        try {
          const tableName = this.extractTableName(trimmedStatement);
          
          if (tableName) {
            const columns = this.extractColumns(trimmedStatement);
            
            const entity: Entity = {
              id: uuidv4(),
              name: tableName,
              columns,
              relationships: []
            };

            entities.push(entity);
          } else {
            errors.push(`Invalid CREATE TABLE statement: ${trimmedStatement}`);
          }
        } catch (error) {
          errors.push(`Error parsing statement: ${trimmedStatement} - ${error}`);
        }
      }
    }

    // Extract relationships after all entities are parsed
    relationships.push(...this.extractRelationships(entities, sql));

    return {
      entities,
      relationships,
      errors
    };
  }
}