import * as cheerio from 'cheerio';
import { serviceLogger } from '../utils/logger.js';

export interface ParsedProductData {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  unit: string;
  unitPrice: number;
  unitType: string;
  weight?: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  tags: string[];
  inStock: boolean;
  nutritionalInfo?: Record<string, string>;
  ingredients?: string;
}

export class HtmlParserService {
  private static instance: HtmlParserService;

  public static getInstance(): HtmlParserService {
    if (!HtmlParserService.instance) {
      HtmlParserService.instance = new HtmlParserService();
    }
    return HtmlParserService.instance;
  }

  /**
   * Parse product data from Rohlik.cz product page HTML
   */
  public parseProductPage(html: string, productId: string): ParsedProductData | null {
    try {
      const $ = cheerio.load(html);
      
      // Extract basic product information
      const name = this.extractProductName($);
      const price = this.extractPrice($);
      const originalPrice = this.extractOriginalPrice($);
      const unit = this.extractUnit($);
      const unitPrice = this.extractUnitPrice($);
      const unitType = this.extractUnitType($);
      const imageUrl = this.extractImageUrl($);
      const description = this.extractDescription($);
      const category = this.extractCategory($);
      const tags = this.extractTags($);
      const inStock = this.extractStockStatus($);
      const weight = this.extractWeight($);
      const nutritionalInfo = this.extractNutritionalInfo($);
      const ingredients = this.extractIngredients($);

      // Calculate discount if applicable
      const discount = originalPrice && price ? 
        Math.round(((originalPrice - price) / originalPrice) * 100) : undefined;

      const productData: ParsedProductData = {
        id: productId,
        name: name || 'Unknown Product',
        price: price || 0,
        originalPrice,
        discount,
        unit: unit || 'ks',
        unitPrice: unitPrice || price || 0,
        unitType: unitType || 'ks',
        weight,
        description,
        imageUrl,
        category,
        tags,
        inStock,
        nutritionalInfo,
        ingredients,
      };

      serviceLogger.info('Product parsed successfully', {
        component: 'HTML_PARSER',
        productId,
        productName: name,
        price,
        discount,
      });

      return productData;
    } catch (error) {
      serviceLogger.error('Failed to parse product page', {
        component: 'HTML_PARSER',
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Parse product list from category or search results page
   */
  public parseProductList(html: string): ParsedProductData[] {
    try {
      const $ = cheerio.load(html);
      const products: ParsedProductData[] = [];

      // Look for product cards in the page
      $('.productCard, .product-card, [data-product-id]').each((index, element) => {
        const $product = $(element);
        const productId = this.extractProductId($product);
        
        if (productId) {
          const productData = this.parseProductCard($product, productId);
          if (productData) {
            products.push(productData);
          }
        }
      });

      serviceLogger.info('Product list parsed', {
        component: 'HTML_PARSER',
        productsFound: products.length,
      });

      return products;
    } catch (error) {
      serviceLogger.error('Failed to parse product list', {
        component: 'HTML_PARSER',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private extractProductName($: cheerio.CheerioAPI): string | undefined {
    // Try multiple selectors for product name
    const selectors = [
      'h1[data-test="product-title"]',
      '.product-title',
      '.productTitle',
      'h1.title',
      '[data-test="product-name"]',
      '.product-name',
    ];

    for (const selector of selectors) {
      const name = $(selector).first().text().trim();
      if (name) return name;
    }

    return undefined;
  }

  private extractPrice($: cheerio.CheerioAPI): number | undefined {
    // Try multiple selectors for current price
    const selectors = [
      '[data-test="product-price"]',
      '.price-current',
      '.product-price',
      '.price',
      '[data-test="price"]',
    ];

    for (const selector of selectors) {
      const priceText = $(selector).first().text().trim();
      const price = this.parsePrice(priceText);
      if (price !== undefined) return price;
    }

    return undefined;
  }

  private extractOriginalPrice($: cheerio.CheerioAPI): number | undefined {
    // Try multiple selectors for original/crossed price
    const selectors = [
      '[data-test="product-price-original"]',
      '.price-original',
      '.price-crossed',
      '.original-price',
      '.price-before',
    ];

    for (const selector of selectors) {
      const priceText = $(selector).first().text().trim();
      const price = this.parsePrice(priceText);
      if (price !== undefined) return price;
    }

    return undefined;
  }

  private extractUnit($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '[data-test="product-unit"]',
      '.product-unit',
      '.unit',
    ];

    for (const selector of selectors) {
      const unit = $(selector).first().text().trim();
      if (unit) return unit;
    }

    return 'ks'; // Default to pieces
  }

  private extractUnitPrice($: cheerio.CheerioAPI): number | undefined {
    const selectors = [
      '[data-test="unit-price"]',
      '.unit-price',
      '.price-per-unit',
    ];

    for (const selector of selectors) {
      const priceText = $(selector).first().text().trim();
      const price = this.parsePrice(priceText);
      if (price !== undefined) return price;
    }

    return undefined;
  }

  private extractUnitType($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '[data-test="unit-type"]',
      '.unit-type',
    ];

    for (const selector of selectors) {
      const unitType = $(selector).first().text().trim();
      if (unitType) return unitType;
    }

    return 'ks';
  }

  private extractImageUrl($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '[data-test="product-image"] img',
      '.product-image img',
      '.productImage img',
      'img[alt*="product"]',
    ];

    for (const selector of selectors) {
      const src = $(selector).first().attr('src');
      if (src) return src.startsWith('http') ? src : `https://www.rohlik.cz${src}`;
    }

    return undefined;
  }

  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '[data-test="product-description"]',
      '.product-description',
      '.description',
      '.product-info',
    ];

    for (const selector of selectors) {
      const description = $(selector).first().text().trim();
      if (description) return description;
    }

    return undefined;
  }

  private extractCategory($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '[data-test="breadcrumb"] a:last-child',
      '.breadcrumb a:last-child',
      '.category-name',
    ];

    for (const selector of selectors) {
      const category = $(selector).first().text().trim();
      if (category) return category;
    }

    return undefined;
  }

  private extractTags($: cheerio.CheerioAPI): string[] {
    const tags: string[] = [];
    
    // Look for quality tags, promotional tags, etc.
    const tagSelectors = [
      '[data-test="product-tag"]',
      '.product-tag',
      '.tag',
      '.badge',
      '.label',
    ];

    tagSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const tag = $(element).text().trim();
        if (tag && !tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });

    return tags;
  }

  private extractStockStatus($: cheerio.CheerioAPI): boolean {
    // Look for out of stock indicators
    const outOfStockSelectors = [
      '[data-test="out-of-stock"]',
      '.out-of-stock',
      '.unavailable',
      '.sold-out',
    ];

    for (const selector of outOfStockSelectors) {
      if ($(selector).length > 0) return false;
    }

    return true; // Default to in stock
  }

  private extractWeight($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '[data-test="product-weight"]',
      '.product-weight',
      '.weight',
    ];

    for (const selector of selectors) {
      const weight = $(selector).first().text().trim();
      if (weight) return weight;
    }

    return undefined;
  }

  private extractNutritionalInfo($: cheerio.CheerioAPI): Record<string, string> | undefined {
    const nutritionalInfo: Record<string, string> = {};
    
    // Look for nutritional information table
    $('.nutritional-info tr, .nutrition-table tr').each((_, row) => {
      const $row = $(row);
      const label = $row.find('td:first-child, th:first-child').text().trim();
      const value = $row.find('td:last-child, th:last-child').text().trim();
      
      if (label && value && label !== value) {
        nutritionalInfo[label] = value;
      }
    });

    return Object.keys(nutritionalInfo).length > 0 ? nutritionalInfo : undefined;
  }

  private extractIngredients($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '[data-test="ingredients"]',
      '.ingredients',
      '.composition',
    ];

    for (const selector of selectors) {
      const ingredients = $(selector).first().text().trim();
      if (ingredients) return ingredients;
    }

    return undefined;
  }

  private parseProductCard($product: cheerio.Cheerio<any>, productId: string): ParsedProductData | null {
    try {
      const name = $product.find('.product-name, .productName, [data-test="product-name"]').first().text().trim();
      const priceText = $product.find('.price, .product-price, [data-test="price"]').first().text().trim();
      const price = this.parsePrice(priceText);
      
      if (!name || price === undefined) {
        return null;
      }

      return {
        id: productId,
        name,
        price,
        unit: 'ks',
        unitPrice: price,
        unitType: 'ks',
        tags: [],
        inStock: true,
      };
    } catch (error) {
      serviceLogger.error('Failed to parse product card', {
        component: 'HTML_PARSER',
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private extractProductId($product: cheerio.Cheerio<any>): string | undefined {
    // Try multiple attributes for product ID
    const idAttributes = ['data-product-id', 'data-id', 'id'];
    
    for (const attr of idAttributes) {
      const id = $product.attr(attr);
      if (id) return id;
    }

    // Try to extract from href
    const href = $product.find('a').first().attr('href');
    if (href) {
      const match = href.match(/\/(\d+)-/);
      if (match) return match[1];
    }

    return undefined;
  }

  private parsePrice(priceText: string): number | undefined {
    if (!priceText) return undefined;
    
    // Remove all non-numeric characters except decimal separators
    const cleanPrice = priceText.replace(/[^\d,.-]/g, '');
    
    // Handle Czech decimal format (comma as decimal separator)
    const normalizedPrice = cleanPrice.replace(',', '.');
    
    const price = parseFloat(normalizedPrice);
    return isNaN(price) ? undefined : price;
  }
} 