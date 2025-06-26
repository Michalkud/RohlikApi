#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      mimeType: string;
      text: string;
    };
  };
}

interface HarLog {
  log: {
    entries: HarEntry[];
  };
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
}

class OpenAPIBuilder {
  private spec: OpenAPISpec;
  private capturesDir: string;

  constructor() {
    this.capturesDir = path.join(__dirname, 'captures');
    this.spec = {
      openapi: '3.1.0',
      info: {
        title: 'Rohlik.cz API',
        version: '1.0.0',
        description: 'Reverse-engineered API specification for Rohlik.cz online supermarket'
      },
      servers: [
        {
          url: 'https://www.rohlik.cz',
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer'
          },
          SessionAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'session'
          }
        }
      }
    };
  }

  private isRohlikApiCall(url: string): boolean {
    const rohlikDomains = [
      'www.rohlik.cz',
      'api.rohlik.cz',
      'rohlik.cz'
    ];
    
    try {
      const urlObj = new URL(url);
      return rohlikDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  private extractPathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  private generateSchema(data: any, name: string): any {
    if (data === null) return { type: 'null' };
    if (typeof data === 'string') return { type: 'string', example: data };
    if (typeof data === 'number') return { type: 'number', example: data };
    if (typeof data === 'boolean') return { type: 'boolean', example: data };
    
    if (Array.isArray(data)) {
      if (data.length === 0) return { type: 'array', items: {} };
      return {
        type: 'array',
        items: this.generateSchema(data[0], `${name}Item`)
      };
    }
    
    if (typeof data === 'object') {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(data)) {
        properties[key] = this.generateSchema(value, `${name}${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (value !== null && value !== undefined) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    }
    
    return {};
  }

  private processHarEntry(entry: HarEntry): void {
    if (!this.isRohlikApiCall(entry.request.url)) {
      return;
    }

    const method = entry.request.method.toLowerCase();
    const path = this.extractPathFromUrl(entry.request.url);
    
    // Generalize path parameters
    const generalizedPath = path
      .replace(/\/\d+/g, '/{id}')
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/{uuid}')
      .replace(/\/c\d+/g, '/{categoryId}');

    if (!this.spec.paths[generalizedPath]) {
      this.spec.paths[generalizedPath] = {};
    }

    const operation: any = {
      summary: `${method.toUpperCase()} ${generalizedPath}`,
      responses: {}
    };

    // Add request body if present
    if (entry.request.postData) {
      try {
        const requestData = JSON.parse(entry.request.postData.text);
        const schemaName = `${method}${generalizedPath.replace(/[^a-zA-Z0-9]/g, '')}Request`;
        this.spec.components.schemas[schemaName] = this.generateSchema(requestData, schemaName);
        
        operation.requestBody = {
          required: true,
          content: {
            [entry.request.postData.mimeType]: {
              schema: { $ref: `#/components/schemas/${schemaName}` }
            }
          }
        };
      } catch (e) {
        // If not JSON, treat as raw data
        operation.requestBody = {
          required: true,
          content: {
            [entry.request.postData.mimeType]: {
              schema: { type: 'string' }
            }
          }
        };
      }
    }

    // Add response
    const statusCode = entry.response.status.toString();
    try {
      if (entry.response.content.text) {
        const responseData = JSON.parse(entry.response.content.text);
        const schemaName = `${method}${generalizedPath.replace(/[^a-zA-Z0-9]/g, '')}Response${statusCode}`;
        this.spec.components.schemas[schemaName] = this.generateSchema(responseData, schemaName);
        
        operation.responses[statusCode] = {
          description: entry.response.statusText || 'Success',
          content: {
            [entry.response.content.mimeType]: {
              schema: { $ref: `#/components/schemas/${schemaName}` }
            }
          }
        };
      } else {
        operation.responses[statusCode] = {
          description: entry.response.statusText || 'Success'
        };
      }
    } catch (e) {
      operation.responses[statusCode] = {
        description: entry.response.statusText || 'Success',
        content: {
          [entry.response.content.mimeType]: {
            schema: { type: 'string' }
          }
        }
      };
    }

    this.spec.paths[generalizedPath][method] = operation;
  }

  private loadCaptureFiles(): HarEntry[] {
    const entries: HarEntry[] = [];
    
    if (!fs.existsSync(this.capturesDir)) {
      console.log('No captures directory found, creating empty spec');
      return entries;
    }

    const files = fs.readdirSync(this.capturesDir)
      .filter(file => file.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(this.capturesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const harData: HarLog = JSON.parse(content);
        
        if (harData.log && harData.log.entries) {
          entries.push(...harData.log.entries);
          console.log(`Loaded ${harData.log.entries.length} entries from ${file}`);
        }
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
      }
    }

    return entries;
  }

  public build(): void {
    console.log('Building OpenAPI specification from captured data...');
    
    const entries = this.loadCaptureFiles();
    console.log(`Processing ${entries.length} total entries`);

    for (const entry of entries) {
      this.processHarEntry(entry);
    }

    // Ensure docs directory exists
    const docsDir = path.join(__dirname, '..', 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write OpenAPI spec as YAML
    const specPath = path.join(docsDir, 'openapi.yaml');
    const yamlContent = yaml.stringify(this.spec);
    fs.writeFileSync(specPath, yamlContent);

    console.log(`OpenAPI specification written to ${specPath}`);
    console.log(`Found ${Object.keys(this.spec.paths).length} unique paths`);
    console.log(`Generated ${Object.keys(this.spec.components.schemas).length} schemas`);
  }
}

// Run the builder
if (require.main === module) {
  const builder = new OpenAPIBuilder();
  builder.build();
} 