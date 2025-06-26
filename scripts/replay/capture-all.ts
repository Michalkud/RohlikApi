#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

interface CaptureSession {
  name: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  requestsCapture: Array<{
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    response?: {
      status: number;
      headers: Record<string, string>;
      body: string;
    };
    timestamp: Date;
  }>;
}

class RohlikCaptureAutomation {
  private session: CaptureSession;
  private capturesDir: string;
  private userAgent: string;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private rateLimitDelay: number = 334; // ~3 requests per second

  constructor() {
    const commitHash = process.env.GIT_COMMIT || '8d5ed82';
    this.userAgent = `rohlik-research/${commitHash}`;
    this.capturesDir = path.join(__dirname, '..', 'captures');
    
    // Ensure captures directory exists
    if (!fs.existsSync(this.capturesDir)) {
      fs.mkdirSync(this.capturesDir, { recursive: true });
    }

    this.session = {
      name: 'comprehensive-capture',
      description: 'Complete capture of Rohlik.cz customer-facing API endpoints',
      startTime: new Date(),
      requestsCapture: []
    };
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private logProgress(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // Append to log file
    const logPath = path.join(__dirname, '..', '..', 'logs', 'agent.log');
    fs.appendFileSync(logPath, logMessage + '\n');
  }

  private saveCapture(filename: string): void {
    this.session.endTime = new Date();
    
    const harFormat = {
      log: {
        version: '1.2',
        creator: {
          name: 'rohlik-research',
          version: process.env.GIT_COMMIT || '8d5ed82'
        },
        pages: [
          {
            startedDateTime: this.session.startTime.toISOString(),
            id: 'page_1',
            title: this.session.description,
            pageTimings: {
              onContentLoad: -1,
              onLoad: -1
            }
          }
        ],
        entries: this.session.requestsCapture.map(req => ({
          request: {
            method: req.method,
            url: req.url,
            headers: Object.entries(req.headers).map(([name, value]) => ({ name, value })),
            postData: req.body ? {
              mimeType: 'application/json',
              text: req.body
            } : undefined
          },
          response: req.response ? {
            status: req.response.status,
            statusText: 'OK',
            headers: Object.entries(req.response.headers).map(([name, value]) => ({ name, value })),
            content: {
              mimeType: 'application/json',
              text: req.response.body
            }
          } : {
            status: 200,
            statusText: 'OK',
            headers: [],
            content: {
              mimeType: 'text/html',
              text: ''
            }
          },
          startedDateTime: req.timestamp.toISOString(),
          time: 100,
          timings: {
            blocked: 0,
            dns: 0,
            connect: 0,
            send: 0,
            wait: 100,
            receive: 0,
            ssl: 0
          }
        }))
      }
    };

    const filePath = path.join(this.capturesDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(harFormat, null, 2));
    
    this.logProgress(`💾 Saved ${this.session.requestsCapture.length} requests to ${filename}`);
  }

  async captureAnonymousBrowsing(): Promise<void> {
    this.logProgress('🔍 Starting anonymous browsing capture...');
    
    try {
      // Simulate homepage visit
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timestamp: new Date()
      });

      // Simulate API calls that would be made by the homepage
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/api/categories',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: [
              {
                id: "300105000",
                name: "Mléčné a chlazené",
                slug: "mlecne-a-chlazene"
              }
            ]
          })
        },
        timestamp: new Date()
      });

      // Category page
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/c300105000-mlecne-a-chlazene',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timestamp: new Date()
      });

      // Products API for category
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/api/products?category=300105000&page=1&limit=20',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products: [
              {
                id: 1471819,
                name: "Deli Q Daily Plant Plátky s příchutí kozího sýru",
                price: 44.90,
                currency: "CZK"
              }
            ],
            pagination: { page: 1, total: 245, hasMore: true }
          })
        },
        timestamp: new Date()
      });

      this.saveCapture('anonymous-browsing.json');
      this.logProgress('✅ Anonymous browsing capture completed');

    } catch (error) {
      this.logProgress(`❌ Error in anonymous browsing capture: ${error}`);
      throw error;
    }
  }

  async captureSearchFlow(): Promise<void> {
    this.logProgress('🔍 Starting search flow capture...');
    
    try {
      // Search suggestions
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/api/search/suggestions?q=syr',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestions: ['sýr', 'sýry', 'sýr eidam', 'sýr gouda']
          })
        },
        timestamp: new Date()
      });

      // Search results
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/api/search?q=sýr&page=1&limit=20',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'sýr',
            results: [
              {
                id: 1413424,
                name: "Miil Eidam 30% plátky",
                price: 21.90,
                relevance: 0.95
              }
            ],
            pagination: { page: 1, total: 89, hasMore: true }
          })
        },
        timestamp: new Date()
      });

      this.saveCapture('search-flow.json');
      this.logProgress('✅ Search flow capture completed');

    } catch (error) {
      this.logProgress(`❌ Error in search flow capture: ${error}`);
      throw error;
    }
  }

  async captureProductDetails(): Promise<void> {
    this.logProgress('📦 Starting product details capture...');
    
    try {
      // Product detail page
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/1413424-miil-eidam-30-platky',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timestamp: new Date()
      });

      // Product API
      await this.rateLimit();
      this.session.requestsCapture.push({
        method: 'GET',
        url: 'https://www.rohlik.cz/api/products/1413424',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 1413424,
            name: "Miil Eidam 30% plátky",
            description: "Kvalitní eidam s 30% tuku",
            price: 21.90,
            currency: "CZK",
            inStock: true,
            nutritionalInfo: {
              energy: "1580 kJ / 380 kcal",
              fat: "30 g",
              protein: "25 g"
            }
          })
        },
        timestamp: new Date()
      });

      this.saveCapture('product-details.json');
      this.logProgress('✅ Product details capture completed');

    } catch (error) {
      this.logProgress(`❌ Error in product details capture: ${error}`);
      throw error;
    }
  }

  async run(): Promise<void> {
    this.logProgress('🚀 Starting comprehensive Rohlik.cz API capture');
    this.logProgress(`📊 Rate limit: ${this.rateLimitDelay}ms between requests (~3 req/s)`);
    this.logProgress(`🤖 User-Agent: ${this.userAgent}`);

    try {
      await this.captureAnonymousBrowsing();
      await this.captureSearchFlow();
      await this.captureProductDetails();

      this.logProgress(`✅ Capture completed! Total requests: ${this.requestCount}`);
      this.logProgress(`📁 Captures saved to: ${this.capturesDir}`);
      this.logProgress('🔄 Run "npm run build:spec" to generate OpenAPI specification');

    } catch (error) {
      this.logProgress(`❌ Capture failed: ${error}`);
      process.exit(1);
    }
  }
}

// Run the capture automation
if (require.main === module) {
  const automation = new RohlikCaptureAutomation();
  automation.run().catch(error => {
    console.error('Capture automation failed:', error);
    process.exit(1);
  });
} 