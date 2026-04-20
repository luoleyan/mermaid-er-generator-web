// Attribute/Column definition
export interface Attribute {
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  is_nullable?: boolean;
  default_value?: string;
  references?: string;
  comment?: string;
}

// Column definition (alias for Attribute for compatibility)
export interface Column {
  id?: string;
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  foreignKey?: {
    referencedTable: string;
    referencedColumn: string;
  };
}

// Entity/Table definition
export interface Entity {
  id?: string;
  name: string;
  attributes?: Attribute[];
  columns: Column[];
  comment?: string;
  relationships?: Relationship[];
}

// Relationship types
export enum RelationshipType {
  ONE_TO_ONE = 'one-to-one',
  ONE_TO_MANY = 'one-to-many',
  MANY_TO_MANY = 'many-to-many',
}

// Relationship definition
export interface Relationship {
  id?: string;
  from: string;
  to: string;
  from_entity?: string;
  from_attribute?: string;
  to_entity?: string;
  to_attribute?: string;
  type: string;
  relationship_type?: RelationshipType;
  name?: string;
  fromColumn?: string;
  toColumn?: string;
}

// Parse result
export interface ParseResult {
  entities: Record<string, Entity> | Entity[];
  relationships: Relationship[];
}

// SQL Parse result
export interface SQLParseResult {
  entities: Entity[];
  relationships: Relationship[];
  errors: string[];
}

// Project definition
export interface Project {
  id: string;
  name: string;
  sql: string;
  created_at: string;
  updated_at: string;
}
