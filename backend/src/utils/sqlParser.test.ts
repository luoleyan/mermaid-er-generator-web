import { SQLParser } from './sqlParser';
import type { Column } from '../types';

describe('SQLParser', () => {
  describe('parseSQL', () => {
    it('should parse a simple CREATE TABLE statement', () => {
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]!.name).toBe('users');
      expect(result.entities[0]!.columns).toHaveLength(4);
      
      const idColumn = result.entities[0]!.columns.find((c: Column) => c.name === 'id');
      expect(idColumn?.primaryKey).toBe(true);
      
      const nameColumn = result.entities[0]!.columns.find((c: Column) => c.name === 'name');
      expect(nameColumn?.nullable).toBe(false);
    });

    it('should parse multiple CREATE TABLE statements', () => {
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        );
        
        CREATE TABLE posts (
          id INT PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          user_id INT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `;

      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0]!.name).toBe('users');
      expect(result.entities[1]!.name).toBe('posts');
    });

    it('should extract foreign key relationships', () => {
      const sql = `
        CREATE TABLE users (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        );
        
        CREATE TABLE posts (
          id INT PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          user_id INT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `;

      const result = SQLParser.parseSQL(sql);
      
      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0]!.from).toBe('users');
      expect(result.relationships[0]!.to).toBe('posts');
      expect(result.relationships[0]!.type).toBe('one-to-many');
    });

    it('should handle complex column types', () => {
      const sql = `
        CREATE TABLE products (
          id INT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2),
          description TEXT,
          is_available BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `;

      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]!.columns).toHaveLength(7);
      
      const priceColumn = result.entities[0]!.columns.find((c: Column) => c.name === 'price');
      expect(priceColumn?.type).toBe('DECIMAL(10,2)');
      
      const isAvailableColumn = result.entities[0]!.columns.find((c: Column) => c.name === 'is_available');
      expect(isAvailableColumn?.type).toBe('BOOLEAN');
    });

    it('should handle quoted table and column names', () => {
      const sql = `
        CREATE TABLE \`users\` (
          \`id\` INT PRIMARY KEY,
          \`name\` VARCHAR(100) NOT NULL,
          \`email\` VARCHAR(255)
        );
      `;

      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]!.name).toBe('users');
      expect(result.entities[0]!.columns[0]!.name).toBe('id');
    });

    it('should handle IF NOT EXISTS syntax', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        );
      `;

      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]!.name).toBe('users');
    });

    it('should handle empty SQL gracefully', () => {
      const sql = '';
      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle invalid SQL gracefully', () => {
      const sql = 'INVALID SQL STATEMENT';
      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });

    it('should handle SQL with comments', () => {
      const sql = `
        -- User table
        CREATE TABLE users (
          id INT PRIMARY KEY, -- User ID
          name VARCHAR(100) NOT NULL -- User name
        );
      `;

      const result = SQLParser.parseSQL(sql);
      
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]!.name).toBe('users');
      expect(result.entities[0]!.columns).toHaveLength(2);
    });
  });
});
