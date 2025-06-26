import { logger } from '../utils/logger.js';
import { RohlikClient } from '../clients/rohlik-client.js';
import { authService } from './auth-service.js';
import { ProductService } from './product-service.js';
import * as cheerio from 'cheerio';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
  imageUrl?: string;
  unit?: string;
  availability?: string;
}

export interface CartSummary {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  deliveryFee?: number;
  finalTotal: number;
  currency: string;
  lastUpdated: Date;
}

export interface AddToCartRequest {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  productId: string;
  quantity: number;
}

class CartService {
  private rohlikClient: RohlikClient;
  private productService: ProductService;
  private cartCache: CartSummary | null = null;
  private readonly CART_URL = '/kosik';
  private readonly ADD_TO_CART_URL = '/api/cart/add';
  private readonly UPDATE_CART_URL = '/api/cart/update';
  private readonly REMOVE_FROM_CART_URL = '/api/cart/remove';

  constructor() {
    this.rohlikClient = new RohlikClient();
    this.productService = ProductService.getInstance();
  }

  /**
   * Get current cart contents
   */
  async getCart(): Promise<CartSummary> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to access cart');
      }

      logger.info('Fetching cart contents', {
        component: 'CART_SERVICE',
      });

      // Get cart page from Rohlik.cz
      const response = await this.rohlikClient.get(this.CART_URL);
      const cartSummary = this.parseCartFromHtml(response.data);

      // Cache the cart data
      this.cartCache = cartSummary;

      logger.info('Cart fetched successfully', {
        component: 'CART_SERVICE',
        totalItems: cartSummary.totalItems,
        totalPrice: cartSummary.totalPrice,
      });

      return cartSummary;

    } catch (error) {
      logger.error('Failed to fetch cart', {
        component: 'CART_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add product to cart
   */
  async addToCart(request: AddToCartRequest): Promise<CartSummary> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to add items to cart');
      }

      logger.info('Adding product to cart', {
        component: 'CART_SERVICE',
        productId: request.productId,
        quantity: request.quantity,
      });

      // Get product details first to validate
      const product = await this.productService.getProduct(request.productId);
      if (!product) {
        throw new Error(`Product ${request.productId} not found`);
      }

      // Try the API endpoint first, fallback to form submission
      let success = false;
      try {
        success = await this.addToCartViaApi(request);
      } catch (apiError) {
        logger.warn('API add-to-cart failed, trying form submission', {
          component: 'CART_SERVICE',
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
        });
        success = await this.addToCartViaForm(request);
      }

      if (success) {
        // Clear cache and fetch updated cart
        this.cartCache = null;
        const updatedCart = await this.getCart();

        logger.info('Product added to cart successfully', {
          component: 'CART_SERVICE',
          productId: request.productId,
          quantity: request.quantity,
          totalItems: updatedCart.totalItems,
        });

        return updatedCart;
      } else {
        throw new Error('Failed to add product to cart');
      }

    } catch (error) {
      logger.error('Failed to add product to cart', {
        component: 'CART_SERVICE',
        productId: request.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update item quantity in cart
   */
  async updateCartItem(request: UpdateCartItemRequest): Promise<CartSummary> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to update cart');
      }

      logger.info('Updating cart item', {
        component: 'CART_SERVICE',
        productId: request.productId,
        quantity: request.quantity,
      });

      // If quantity is 0, remove the item
      if (request.quantity === 0) {
        return await this.removeFromCart(request.productId);
      }

      // Try API endpoint first, fallback to form submission
      let success = false;
      try {
        success = await this.updateCartViaApi(request);
      } catch (apiError) {
        logger.warn('API update-cart failed, trying form submission', {
          component: 'CART_SERVICE',
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
        });
        success = await this.updateCartViaForm(request);
      }

      if (success) {
        // Clear cache and fetch updated cart
        this.cartCache = null;
        const updatedCart = await this.getCart();

        logger.info('Cart item updated successfully', {
          component: 'CART_SERVICE',
          productId: request.productId,
          quantity: request.quantity,
        });

        return updatedCart;
      } else {
        throw new Error('Failed to update cart item');
      }

    } catch (error) {
      logger.error('Failed to update cart item', {
        component: 'CART_SERVICE',
        productId: request.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Remove product from cart
   */
  async removeFromCart(productId: string): Promise<CartSummary> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to remove items from cart');
      }

      logger.info('Removing product from cart', {
        component: 'CART_SERVICE',
        productId,
      });

      // Try API endpoint first, fallback to form submission
      let success = false;
      try {
        success = await this.removeFromCartViaApi(productId);
      } catch (apiError) {
        logger.warn('API remove-from-cart failed, trying form submission', {
          component: 'CART_SERVICE',
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
        });
        success = await this.removeFromCartViaForm(productId);
      }

      if (success) {
        // Clear cache and fetch updated cart
        this.cartCache = null;
        const updatedCart = await this.getCart();

        logger.info('Product removed from cart successfully', {
          component: 'CART_SERVICE',
          productId,
        });

        return updatedCart;
      } else {
        throw new Error('Failed to remove product from cart');
      }

    } catch (error) {
      logger.error('Failed to remove product from cart', {
        component: 'CART_SERVICE',
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(): Promise<CartSummary> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to clear cart');
      }

      logger.info('Clearing entire cart', {
        component: 'CART_SERVICE',
      });

      // Get current cart to know what items to remove
      const currentCart = await this.getCart();

      // Remove each item individually
      for (const item of currentCart.items) {
        await this.removeFromCart(item.productId);
      }

      // Clear cache and return empty cart
      this.cartCache = null;
      const emptyCart = await this.getCart();

      logger.info('Cart cleared successfully', {
        component: 'CART_SERVICE',
      });

      return emptyCart;

    } catch (error) {
      logger.error('Failed to clear cart', {
        component: 'CART_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get cached cart if available
   */
  getCachedCart(): CartSummary | null {
    return this.cartCache;
  }

  /**
   * Clear cart cache
   */
  clearCartCache(): void {
    this.cartCache = null;
    logger.debug('Cart cache cleared', {
      component: 'CART_SERVICE',
    });
  }

  /**
   * Parse cart data from HTML response
   */
  private parseCartFromHtml(html: string): CartSummary {
    const $ = cheerio.load(html);
    const items: CartItem[] = [];

    // Parse cart items from the HTML
    $('.cart-item, .kosik-item, [data-product-id]').each((index, element) => {
      const $item = $(element);
      
      const productId = $item.attr('data-product-id') || 
                       $item.find('[data-product-id]').attr('data-product-id') ||
                       $item.find('input[name*="product"]').val() as string;

      const name = $item.find('.product-name, .item-name, h3, h4').text().trim() ||
                  $item.find('a').text().trim();

      const priceText = $item.find('.price, .item-price, .total-price').text().trim();
      const price = this.parsePrice(priceText);

      const quantityText = $item.find('.quantity, input[type="number"]').val() as string ||
                          $item.find('.quantity, .item-quantity').text().trim();
      const quantity = parseInt(quantityText) || 1;

      const imageUrl = $item.find('img').attr('src');
      const unit = $item.find('.unit, .item-unit').text().trim();
      const availability = $item.find('.availability, .item-availability').text().trim();

      if (productId && name && price > 0) {
        items.push({
          productId,
          name,
          price,
          quantity,
          totalPrice: price * quantity,
          imageUrl,
          unit: unit || undefined,
          availability: availability || undefined,
        });
      }
    });

    // Parse totals
    const totalItemsText = $('.cart-total-items, .kosik-pocet, [data-total-items]').text().trim();
    const totalItems = parseInt(totalItemsText) || items.reduce((sum, item) => sum + item.quantity, 0);

    const totalPriceText = $('.cart-total-price, .kosik-cena, .total-price').last().text().trim();
    const totalPrice = this.parsePrice(totalPriceText) || 
                      items.reduce((sum, item) => sum + item.totalPrice, 0);

    const deliveryFeeText = $('.delivery-fee, .doprava, .shipping-cost').text().trim();
    const deliveryFee = deliveryFeeText ? this.parsePrice(deliveryFeeText) : undefined;

    const finalTotal = totalPrice + (deliveryFee || 0);

    return {
      items,
      totalItems,
      totalPrice,
      deliveryFee,
      finalTotal,
      currency: 'CZK',
      lastUpdated: new Date(),
    };
  }

  /**
   * Parse price from Czech format (e.g., "123,45 Kč")
   */
  private parsePrice(priceText: string): number {
    if (!priceText) return 0;
    
    // Remove currency symbols and whitespace
    const cleanText = priceText.replace(/[^\d,.-]/g, '');
    
    // Handle Czech decimal separator (comma)
    const normalizedText = cleanText.replace(',', '.');
    
    const price = parseFloat(normalizedText);
    return isNaN(price) ? 0 : price;
  }

  /**
   * Add to cart via API endpoint
   */
  private async addToCartViaApi(request: AddToCartRequest): Promise<boolean> {
    try {
      const response = await this.rohlikClient.post(this.ADD_TO_CART_URL, {
        productId: request.productId,
        quantity: request.quantity,
      });

      return response.status === 200 && response.data?.success === true;
    } catch (error) {
      logger.debug('API add-to-cart failed', {
        component: 'CART_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Add to cart via form submission (fallback)
   */
  private async addToCartViaForm(request: AddToCartRequest): Promise<boolean> {
    try {
      // Get product page to find the add-to-cart form
      const productResponse = await this.rohlikClient.get(`/${request.productId}`);
      const $ = cheerio.load(productResponse.data);

      // Find add-to-cart form
      const form = $('form[action*="cart"], form[action*="kosik"], .add-to-cart-form').first();
      const formAction = form.attr('action') || '/kosik/pridat';
      
      // Extract form data
      const formData = new URLSearchParams();
      form.find('input').each((index, element) => {
        const $input = $(element);
        const name = $input.attr('name');
        const value = $input.val() as string;
        if (name && value) {
          formData.append(name, value);
        }
      });

      // Set product ID and quantity
      formData.set('product_id', request.productId);
      formData.set('quantity', request.quantity.toString());

      const response = await this.rohlikClient.post(formAction, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.status < 400;
    } catch (error) {
      logger.debug('Form add-to-cart failed', {
        component: 'CART_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Update cart via API endpoint
   */
  private async updateCartViaApi(request: UpdateCartItemRequest): Promise<boolean> {
    try {
      const response = await this.rohlikClient.post(this.UPDATE_CART_URL, {
        productId: request.productId,
        quantity: request.quantity,
      });

      return response.status === 200 && response.data?.success === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update cart via form submission (fallback)
   */
  private async updateCartViaForm(request: UpdateCartItemRequest): Promise<boolean> {
    try {
      // Get cart page to find update form
      const cartResponse = await this.rohlikClient.get(this.CART_URL);
      const $ = cheerio.load(cartResponse.data);

      // Find the specific item's update form
      const itemForm = $(`[data-product-id="${request.productId}"] form, 
                         form[data-product-id="${request.productId}"]`).first();
      
      if (itemForm.length === 0) {
        throw new Error('Could not find update form for product');
      }

      const formAction = itemForm.attr('action') || '/kosik/upravit';
      
      const formData = new URLSearchParams();
      itemForm.find('input').each((index, element) => {
        const $input = $(element);
        const name = $input.attr('name');
        const value = $input.val() as string;
        if (name && value) {
          formData.append(name, value);
        }
      });

      // Update quantity
      formData.set('quantity', request.quantity.toString());

      const response = await this.rohlikClient.post(formAction, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove from cart via API endpoint
   */
  private async removeFromCartViaApi(productId: string): Promise<boolean> {
    try {
      const response = await this.rohlikClient.post(this.REMOVE_FROM_CART_URL, {
        productId,
      });

      return response.status === 200 && response.data?.success === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove from cart via form submission (fallback)
   */
  private async removeFromCartViaForm(productId: string): Promise<boolean> {
    try {
      // Update quantity to 0 to remove item
      return await this.updateCartViaForm({ productId, quantity: 0 });
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const cartService = new CartService(); 