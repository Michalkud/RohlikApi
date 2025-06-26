import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Rohlik.cz API Mock Server', () => {
  test('should respond to health check', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
  });

  test('should serve API documentation', async ({ page }) => {
    await page.goto(`${BASE_URL}/docs`);
    await expect(page).toHaveTitle(/Swagger UI/);
    await expect(page.locator('h2')).toContainText('Rohlik.cz API');
  });

  test('should return categories', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/categories`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('categories');
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThan(0);
    
    const firstCategory = data.categories[0];
    expect(firstCategory).toHaveProperty('id');
    expect(firstCategory).toHaveProperty('name');
    expect(firstCategory).toHaveProperty('slug');
  });

  test('should return products list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/products`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('products');
    expect(data).toHaveProperty('pagination');
    expect(Array.isArray(data.products)).toBe(true);
    
    if (data.products.length > 0) {
      const firstProduct = data.products[0];
      expect(firstProduct).toHaveProperty('id');
      expect(firstProduct).toHaveProperty('name');
      expect(firstProduct).toHaveProperty('price');
      expect(firstProduct).toHaveProperty('currency');
    }
  });

  test('should return product details', async ({ request }) => {
    const productId = '1413424';
    const response = await request.get(`${BASE_URL}/api/products/${productId}`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('id', parseInt(productId));
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('price');
    expect(data).toHaveProperty('currency');
    expect(data).toHaveProperty('inStock');
    expect(data).toHaveProperty('nutritionalInfo');
  });

  test('should return cart information', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/cart`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('summary');
    expect(Array.isArray(data.items)).toBe(true);
  });

  test('should handle adding items to cart', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/cart/items`, {
      data: {
        productId: 1413424,
        quantity: 2
      }
    });
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('cart');
  });

  test('should handle authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('user');
    expect(data).toHaveProperty('token');
    expect(data).toHaveProperty('refreshToken');
    expect(data).toHaveProperty('expiresIn');
  });

  test('should handle invalid authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: '',
        password: ''
      }
    });
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should handle category routes with Rohlik URL pattern', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/c300105000-mlecne-a-chlazene`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('category');
    expect(data.category).toHaveProperty('id', '300105000');
    expect(data.category).toHaveProperty('name');
    expect(data.category).toHaveProperty('products');
  });

  test('should serve root endpoint with API information', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('docs');
    expect(data).toHaveProperty('endpoints');
  });
}); 