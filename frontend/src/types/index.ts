export interface Entity {
  id: string;
  name: string;
  columns: Column[];
  relationships: Relationship[];
}

export interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: ForeignKey;
}

export interface ForeignKey {
  referencedTable: string;
  referencedColumn: string;
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromColumn: string;
  toColumn: string;
}

export interface SQLParseResult {
  entities: Entity[];
  relationships: Relationship[];
  errors: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  sql: string;
  entities: Entity[];
  relationships: Relationship[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf';
  theme: 'default' | 'dark' | 'forest' | 'neutral';
}

export interface MermaidConfig {
  theme: string;
  securityLevel: 'loose' | 'strict' | 'antiscript';
  fontFamily: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}