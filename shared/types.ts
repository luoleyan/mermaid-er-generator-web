// Attribute definition (for MermaidERParser compatibility)
export interface Attribute {
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  is_nullable?: boolean;
  default_value?: string;
  comment?: string;
}

// Column definition
export interface Column {
  id?: string;
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  foreignKey?: {
    referencedTable: string;
    referencedColumn: string;
  };
  defaultValue?: string;
  comment?: string;
}

// Entity/Table definition
export interface Entity {
  id?: string;
  name: string;
  columns: Column[];
  attributes?: Attribute[];
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
  type: string;
  name?: string;
  fromColumn?: string;
  toColumn?: string;
  from_entity?: string;
  from_attribute?: string;
  to_entity?: string;
  to_attribute?: string;
  relationship_type?: RelationshipType;
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
  description?: string;
  sql: string;
  entities?: Entity[];
  relationships?: Relationship[];
  createdAt: Date;
  updatedAt: Date;
  created_at?: string;
  updated_at?: string;
}

// Export options
export type ExportFormat = 'png' | 'svg' | 'pdf';

export interface ExportConfig {
  format: ExportFormat;
  theme: string;
  fontFamily: string;
  viewMode: 'classic' | 'physical' | 'chen';
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

export interface MermaidConfig {
  theme: string;
  securityLevel: 'loose' | 'strict' | 'antiscript';
  fontFamily: string;
  viewMode?: 'classic' | 'physical' | 'chen';
  chenPinnedEntities?: string[];
  exportOptions?: ExportConfig['exportOptions'];
}

export type ViewMode = 'classic' | 'physical' | 'chen';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
