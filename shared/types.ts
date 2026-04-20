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

export interface Entity {
  name: string;
  attributes: Attribute[];
  comment?: string;
}

export enum RelationshipType {
  ONE_TO_ONE = 'one-to-one',
  ONE_TO_MANY = 'one-to-many',
  MANY_TO_MANY = 'many-to-many',
}

export interface Relationship {
  from_entity: string;
  from_attribute: string;
  to_entity: string;
  to_attribute: string;
  relationship_type: RelationshipType;
  name?: string;
}

export interface ParseResult {
  entities: Record<string, Entity>;
  relationships: Relationship[];
}

export interface Project {
  id: string;
  name: string;
  sql: string;
  created_at: string;
  updated_at: string;
}
