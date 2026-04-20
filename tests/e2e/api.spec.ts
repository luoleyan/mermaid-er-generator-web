import { test, expect } from '@playwright/test';

test.describe('API Integration', () => {
  test('should parse SQL via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/sql/parse', {
      data: {
        sql: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.entities).toHaveLength(1);
    expect(data.data.entities[0].name).toBe('users');
  });

  test('should handle invalid SQL via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/sql/parse', {
      data: {
        sql: 'INVALID SQL STATEMENT'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.errors).toHaveLength(1);
  });

  test('should generate diagram via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/sql/generate', {
      data: {
        sql: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));',
        theme: 'default'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.diagram).toContain('erDiagram');
  });

  test('should manage projects via API', async ({ request }) => {
    // Create project
    const createResponse = await request.post('http://localhost:3001/api/projects', {
      data: {
        name: 'Test Project',
        sql: 'CREATE TABLE test (id INT);'
      }
    });

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const projectId = createData.data.id;

    // Get project
    const getResponse = await request.get(`http://localhost:3001/api/projects/${projectId}`);
    expect(getResponse.status()).toBe(200);
    const getData = await getResponse.json();
    expect(getData.data.name).toBe('Test Project');

    // Update project
    const updateResponse = await request.put(`http://localhost:3001/api/projects/${projectId}`, {
      data: {
        name: 'Updated Test Project'
      }
    });
    expect(updateResponse.status()).toBe(200);
    const updateData = await updateResponse.json();
    expect(updateData.data.name).toBe('Updated Test Project');

    // Delete project
    const deleteResponse = await request.delete(`http://localhost:3001/api/projects/${projectId}`);
    expect(deleteResponse.status()).toBe(200);

    // Verify deletion
    const verifyResponse = await request.get(`http://localhost:3001/api/projects/${projectId}`);
    expect(verifyResponse.status()).toBe(404);
  });

  test('should export diagrams via API', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/export/svg', {
      data: {
        sql: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));',
        theme: 'default'
      }
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('svg');
  });
});