#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import yaml from 'yaml';

async function validateSpec(): Promise<void> {
  const specPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
  
  if (!fs.existsSync(specPath)) {
    console.error('OpenAPI specification not found at:', specPath);
    console.error('Run "npm run build:spec" first');
    process.exit(1);
  }

  try {
    console.log('Validating OpenAPI specification...');
    
    // Read and parse the YAML file
    const specContent = fs.readFileSync(specPath, 'utf8');
    const spec = yaml.parse(specContent);
    
    // Validate the specification
    const api = await SwaggerParser.validate(spec);
    
    console.log('✅ OpenAPI specification is valid!');
    console.log(`📋 API: ${api.info.title} v${api.info.version}`);
    console.log(`🛤️  Paths: ${Object.keys(api.paths || {}).length}`);
    console.log(`📊 Schemas: ${Object.keys((api as any).components?.schemas || {}).length}`);
    
    // Additional checks
    const paths = Object.keys((api as any).paths || {});
    const methods = new Set<string>();
    
    for (const pathKey of paths) {
      const pathItem = (api as any).paths![pathKey];
      Object.keys(pathItem || {}).forEach(method => {
        if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
          methods.add(method.toUpperCase());
        }
      });
    }
    
    console.log(`🔧 HTTP Methods: ${Array.from(methods).join(', ')}`);
    
    // Check for common patterns
    const authPaths = paths.filter(p => p.includes('auth') || p.includes('login'));
    const productPaths = paths.filter(p => p.includes('product') || p.includes('item'));
    const cartPaths = paths.filter(p => p.includes('cart') || p.includes('basket'));
    const orderPaths = paths.filter(p => p.includes('order') || p.includes('checkout'));
    
    console.log('\n📈 API Coverage:');
    console.log(`🔐 Authentication endpoints: ${authPaths.length}`);
    console.log(`🛍️  Product endpoints: ${productPaths.length}`);
    console.log(`🛒 Cart endpoints: ${cartPaths.length}`);
    console.log(`📦 Order endpoints: ${orderPaths.length}`);
    
    if (authPaths.length === 0) {
      console.warn('⚠️  No authentication endpoints found - consider capturing login flows');
    }
    
    if (cartPaths.length === 0) {
      console.warn('⚠️  No cart endpoints found - consider capturing cart operations');
    }
    
    if (orderPaths.length === 0) {
      console.warn('⚠️  No order endpoints found - consider capturing checkout flows');
    }
    
  } catch (error) {
    console.error('❌ OpenAPI specification validation failed:');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run validation
if (require.main === module) {
  validateSpec().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
} 