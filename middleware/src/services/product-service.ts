import { RohlikClient } from '../clients/rohlik-client.js';
import { HtmlParserService, type ParsedProductData } from './html-parser.js';
import { productLogger } from '../utils/logger.js';
import type { RohlikProduct } from '../types/rohlik-api.js';

export interface ProductSearchOptions {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export class ProductService {
  private static instance: ProductService;
  private rohlikClient: RohlikClient;
  private htmlParser: HtmlParserService;
  private productCache: Map<string, ParsedProductData>;
  private cacheTimeout: number = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    this.rohlikClient = new RohlikClient();
    this.htmlParser = HtmlParserService.getInstance();
    this.productCache = new Map();
  }

  public static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  /**
   * Get product details by ID
   */
  public async getProduct(productId: string): Promise<ParsedProductData | null> {
    try {
      // Check cache first
      const cachedProduct = this.getCachedProduct(productId);
      if (cachedProduct) {
        productLogger.info('Product returned from cache', {
          productId,
          productName: cachedProduct.name,
        });
        return cachedProduct;
      }

      productLogger.info('Fetching product from Rohlik.cz', { productId });

      // Fetch product page HTML
      const productUrl = `/${productId}-`;
      const response = await this.rohlikClient.get(productUrl);
      const html = response.data;

      if (!html) {
        productLogger.warn('No HTML received for product', { productId });
        return null;
      }

      // Parse product data from HTML
      const productData = this.htmlParser.parseProductPage(html, productId);

      if (productData) {
        // Cache the product
        this.cacheProduct(productId, productData);
        
        productLogger.info('Product fetched and parsed successfully', {
          productId,
          productName: productData.name,
          price: productData.price,
          discount: productData.discount,
        });
      } else {
        productLogger.warn('Failed to parse product data', { productId });
      }

      return productData;
    } catch (error) {
      productLogger.error('Failed to get product', {
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get multiple products by IDs
   */
  public async getProducts(productIds: string[]): Promise<ParsedProductData[]> {
    try {
      productLogger.info('Fetching multiple products', {
        productIds,
        count: productIds.length,
      });

      const products: ParsedProductData[] = [];
      
      // Process products in parallel (but with rate limiting)
      const batchSize = 5; // Process 5 products at a time
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const batchPromises = batch.map(id => this.getProduct(id));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(product => {
          if (product) {
            products.push(product);
          }
        });

        // Small delay between batches to be respectful
        if (i + batchSize < productIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      productLogger.info('Multiple products fetched', {
        requested: productIds.length,
        successful: products.length,
      });

      return products;
    } catch (error) {
      productLogger.error('Failed to get multiple products', {
        productIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Search for products
   */
  public async searchProducts(options: ProductSearchOptions = {}): Promise<ParsedProductData[]> {
    try {
      const { query, category, limit = 20, offset = 0 } = options;

      productLogger.info('Searching products', {
        query,
        category,
        limit,
        offset,
      });

      let searchUrl = '/';
      const params = new URLSearchParams();

      if (query) {
        searchUrl = '/hledat';
        params.set('q', query);
      } else if (category) {
        searchUrl = `/${category}`;
      }

      if (limit) params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());

      const fullUrl = searchUrl + (params.toString() ? '?' + params.toString() : '');
      
      const response = await this.rohlikClient.get(fullUrl);
      const html = response.data;

      if (!html) {
        productLogger.warn('No HTML received for search', { searchUrl: fullUrl });
        return [];
      }

      const products = this.htmlParser.parseProductList(html);

      // Cache found products
      products.forEach(product => {
        this.cacheProduct(product.id, product);
      });

      productLogger.info('Product search completed', {
        query,
        category,
        productsFound: products.length,
      });

      return products;
    } catch (error) {
      productLogger.error('Failed to search products', {
        options,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get products from a specific category
   */
  public async getCategoryProducts(categoryPath: string, limit: number = 20): Promise<ParsedProductData[]> {
    return this.searchProducts({ category: categoryPath, limit });
  }

  /**
   * Get our known test products (from reverse engineering phase)
   */
  public async getKnownProducts(): Promise<ParsedProductData[]> {
    const knownProductIds = [
      '1440986', // Sutcha Prime Rump steak
      '1412825', // FJORU ASC Krevety
      '1354611', // Meloun vodní červený
      '1294559', // Okurka hadovka
      '1287919', // Ledový salát
      '1326593', // Dublin Dairy cheddar
      '1295189', // Monster Energy
    ];

    return this.getProducts(knownProductIds);
  }

  /**
   * Convert parsed product data to API format
   */
  public toApiFormat(product: ParsedProductData): RohlikProduct {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      discount: product.discount,
      unit: product.unit,
      unitPrice: product.unitPrice,
      unitType: product.unitType,
      weight: product.weight,
      description: product.description,
      imageUrl: product.imageUrl,
      category: product.category,
      tags: product.tags,
      inStock: product.inStock,
      minQuantity: 1,
      maxQuantity: 100,
    };
  }

  /**
   * Clear product cache
   */
  public clearCache(): void {
    this.productCache.clear();
    productLogger.info('Product cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; products: string[] } {
    return {
      size: this.productCache.size,
      products: Array.from(this.productCache.keys()),
    };
  }

  private getCachedProduct(productId: string): ParsedProductData | null {
    const cached = this.productCache.get(productId);
    if (!cached) return null;

    // Check if cache entry is still valid
    const now = Date.now();
    const cacheTime = (cached as any)._cacheTime || 0;
    
    if (now - cacheTime > this.cacheTimeout) {
      this.productCache.delete(productId);
      return null;
    }

    return cached;
  }

  private cacheProduct(productId: string, product: ParsedProductData): void {
    // Add cache timestamp
    (product as any)._cacheTime = Date.now();
    this.productCache.set(productId, product);
  }
} 