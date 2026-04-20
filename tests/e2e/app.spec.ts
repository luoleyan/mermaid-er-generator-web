import { test, expect } from '@playwright/test';

test.describe('Main Application', () => {
  test('should load the application successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check if the main title is visible
    await expect(page.getByRole('heading', { name: 'Mermaid ER Generator' })).toBeVisible();
    
    // Check if there's a welcome message
    await expect(page.getByText('Welcome to Mermaid ER Generator')).toBeVisible();
  });

  test('should display SQL input section', async ({ page }) => {
    await page.goto('/');
    
    // Check if SQL input section is present
    await expect(page.getByText('SQL 输入')).toBeVisible();
  });

  test('should handle theme selection', async ({ page }) => {
    await page.goto('/');
    
    // Check if theme selector is present
    const themeSelector = page.locator('select').first();
    await expect(themeSelector).toBeVisible();
    
    // Check default theme
    await expect(themeSelector).toHaveValue('default');
    
    // Change theme
    await themeSelector.selectOption({ label: '深色' });
    await expect(themeSelector).toHaveValue('dark');
  });
});

test.describe('SQL Functionality', () => {
  test('should parse SQL successfully', async ({ page }) => {
    await page.goto('/');
    
    // Enter SQL
    const sqlInput = page.locator('textarea').first();
    await sqlInput.fill('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));');
    
    // Click parse button
    await page.getByRole('button', { name: '解析 SQL' }).click();
    
    // Wait for success message
    await expect(page.getByText('SQL 解析成功')).toBeVisible();
  });

  test('should show error for invalid SQL', async ({ page }) => {
    await page.goto('/');
    
    // Enter invalid SQL
    const sqlInput = page.locator('textarea').first();
    await sqlInput.fill('INVALID SQL STATEMENT');
    
    // Click parse button
    await page.getByRole('button', { name: '解析 SQL' }).click();
    
    // Wait for error message
    await expect(page.getByText('解析失败，请检查 SQL 语法')).toBeVisible();
  });

  test('should generate ER diagram', async ({ page }) => {
    await page.goto('/');
    
    // Enter valid SQL
    const sqlInput = page.locator('textarea').first();
    await sqlInput.fill('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100)); CREATE TABLE posts (id INT PRIMARY KEY, user_id INT, FOREIGN KEY (user_id) REFERENCES users(id));');
    
    // Click generate button
    await page.getByRole('button', { name: '生成 ER 图' }).click();
    
    // Wait for success message
    await expect(page.getByText('ER 图生成成功')).toBeVisible();
    
    // Check if ER diagram section is visible
    await expect(page.getByText('ER 图')).toBeVisible();
  });
});

test.describe('Export Functionality', () => {
  test('should export SVG diagram', async ({ page }) => {
    await page.goto('/');
    
    // Enter valid SQL
    const sqlInput = page.locator('textarea').first();
    await sqlInput.fill('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));');
    
    // Generate diagram first
    await page.getByRole('button', { name: '生成 ER 图' }).click();
    
    // Wait for generation to complete
    await page.waitForTimeout(1000);
    
    // Click export SVG button
    const [download] = Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '导出 SVG' }).click()
    ]);
    
    // Check if download started
    const downloadPromise = download;
    await expect(downloadPromise).resolves.toBeDefined();
  });

  test('should show error when trying to export without SQL', async ({ page }) => {
    await page.goto('/');
    
    // Try to export without entering SQL
    await page.getByRole('button', { name: '导出 SVG' }).click();
    
    // Check for error message
    await expect(page.getByText('请先输入 SQL 语句')).toBeVisible();
  });
});