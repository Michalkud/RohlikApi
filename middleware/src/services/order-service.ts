import { logger } from '../utils/logger.js';
import { RohlikClient } from '../clients/rohlik-client.js';
import { authService } from './auth-service.js';
import { cartService, CartItem } from './cart-service.js';
import { locationService, DeliveryAddress, DeliverySlot } from './location-service.js';
import * as cheerio from 'cheerio';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  category?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: DeliveryAddress;
  deliverySlot?: DeliverySlot;
  paymentMethod?: string;
  specialInstructions?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export interface CheckoutValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedTotal: number;
  deliveryFee: number;
  availablePaymentMethods: string[];
  requiredDeliverySlot: boolean;
}

export interface CheckoutRequest {
  deliverySlotId?: string;
  paymentMethod: string;
  specialInstructions?: string;
  confirmInventory?: boolean;
}

export interface CheckoutResult {
  success: boolean;
  order?: Order;
  errors: string[];
  confirmationUrl?: string;
  paymentUrl?: string;
}

class OrderService {
  private rohlikClient: RohlikClient;
  private ordersCache: Map<string, Order> = new Map();
  private readonly CHECKOUT_URL = '/checkout';
  private readonly ORDERS_URL = '/objednavky';
  private readonly ORDER_STATUS_URL = '/objednavka';

  constructor() {
    this.rohlikClient = new RohlikClient();
  }

  /**
   * Validate checkout requirements
   */
  async validateCheckout(): Promise<CheckoutValidation> {
    try {
      if (!authService.isAuthenticated()) {
        return {
          isValid: false,
          errors: ['User must be authenticated to checkout'],
          warnings: [],
          estimatedTotal: 0,
          deliveryFee: 0,
          availablePaymentMethods: [],
          requiredDeliverySlot: true,
        };
      }

      logger.info('Validating checkout requirements', {
        component: 'ORDER_SERVICE',
      });

      const errors: string[] = [];
      const warnings: string[] = [];

      // Check cart
      const cart = await cartService.getCart();
      if (!cart.items || cart.items.length === 0) {
        errors.push('Cart is empty');
      }

      // Check delivery address
      const deliveryAddress = locationService.getCurrentAddress();
      if (!deliveryAddress) {
        errors.push('Delivery address must be set');
      }

      // Calculate delivery fee
      const deliveryFee = await locationService.calculateDeliveryFee();

      // Get available payment methods
      const paymentMethods = await this.getAvailablePaymentMethods();

      // Check minimum order value
      const subtotal = cart.total || 0;
      const minOrderValue = 500; // Default minimum for Czech Republic
      
      if (subtotal < minOrderValue) {
        errors.push(`Minimum order value is ${minOrderValue} Kč (current: ${subtotal} Kč)`);
      }

      // Check inventory availability
      const inventoryCheck = await this.checkInventoryAvailability(cart.items);
      if (inventoryCheck.unavailableItems.length > 0) {
        warnings.push(`Some items may not be available: ${inventoryCheck.unavailableItems.join(', ')}`);
      }

      const estimatedTotal = subtotal + deliveryFee;

      const validation: CheckoutValidation = {
        isValid: errors.length === 0,
        errors,
        warnings,
        estimatedTotal,
        deliveryFee,
        availablePaymentMethods: paymentMethods,
        requiredDeliverySlot: true,
      };

      logger.info('Checkout validation completed', {
        component: 'ORDER_SERVICE',
        isValid: validation.isValid,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        estimatedTotal,
      });

      return validation;

    } catch (error) {
      logger.error('Failed to validate checkout', {
        component: 'ORDER_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
        errors: ['Failed to validate checkout requirements'],
        warnings: [],
        estimatedTotal: 0,
        deliveryFee: 0,
        availablePaymentMethods: [],
        requiredDeliverySlot: true,
      };
    }
  }

  /**
   * Complete checkout and create order
   */
  async checkout(checkoutRequest: CheckoutRequest): Promise<CheckoutResult> {
    try {
      if (!authService.isAuthenticated()) {
        return {
          success: false,
          errors: ['User must be authenticated to checkout'],
        };
      }

      logger.info('Starting checkout process', {
        component: 'ORDER_SERVICE',
        paymentMethod: checkoutRequest.paymentMethod,
        deliverySlotId: checkoutRequest.deliverySlotId,
      });

      // Validate checkout first
      const validation = await this.validateCheckout();
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Get cart and address
      const cart = await cartService.getCart();
      const deliveryAddress = locationService.getCurrentAddress();
      
      if (!deliveryAddress) {
        return {
          success: false,
          errors: ['Delivery address is required'],
        };
      }

      // Submit order to Rohlik.cz
      const orderSubmission = await this.submitOrderToRohlik(
        cart.items,
        deliveryAddress,
        checkoutRequest
      );

      if (orderSubmission.success && orderSubmission.order) {
        // Clear cart after successful order
        await cartService.clearCart();
        
        // Cache the order
        this.ordersCache.set(orderSubmission.order.id, orderSubmission.order);

        logger.info('Checkout completed successfully', {
          component: 'ORDER_SERVICE',
          orderId: orderSubmission.order.id,
          orderNumber: orderSubmission.order.orderNumber,
          total: orderSubmission.order.total,
        });
      }

      return orderSubmission;

    } catch (error) {
      logger.error('Checkout failed', {
        component: 'ORDER_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentMethod: checkoutRequest.paymentMethod,
      });

      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Checkout failed'],
      };
    }
  }

  /**
   * Get user's order history
   */
  async getOrderHistory(): Promise<Order[]> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to view order history');
      }

      logger.info('Fetching order history', {
        component: 'ORDER_SERVICE',
      });

      // Get orders page from Rohlik.cz
      const response = await this.rohlikClient.get(this.ORDERS_URL);
      const orders = this.parseOrderHistory(response.data);

      // Cache orders
      orders.forEach(order => {
        this.ordersCache.set(order.id, order);
      });

      logger.info('Order history fetched successfully', {
        component: 'ORDER_SERVICE',
        ordersCount: orders.length,
      });

      return orders;

    } catch (error) {
      logger.error('Failed to get order history', {
        component: 'ORDER_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get specific order details
   */
  async getOrder(orderId: string): Promise<Order | null> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to view order details');
      }

      // Check cache first
      const cached = this.ordersCache.get(orderId);
      if (cached) {
        return cached;
      }

      logger.info('Fetching order details', {
        component: 'ORDER_SERVICE',
        orderId,
      });

      // Get order details from Rohlik.cz
      const response = await this.rohlikClient.get(`${this.ORDER_STATUS_URL}/${orderId}`);
      const order = this.parseOrderDetails(response.data, orderId);

      if (order) {
        // Cache the order
        this.ordersCache.set(orderId, order);

        logger.info('Order details fetched successfully', {
          component: 'ORDER_SERVICE',
          orderId,
          orderNumber: order.orderNumber,
          status: order.status,
        });
      }

      return order;

    } catch (error) {
      logger.error('Failed to get order details', {
        component: 'ORDER_SERVICE',
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to cancel order');
      }

      logger.info('Cancelling order', {
        component: 'ORDER_SERVICE',
        orderId,
      });

      // Submit cancellation to Rohlik.cz
      const response = await this.rohlikClient.post(`${this.ORDER_STATUS_URL}/${orderId}/cancel`, {});
      
      const success = response.status === 200;

      if (success) {
        // Update cached order status
        const cachedOrder = this.ordersCache.get(orderId);
        if (cachedOrder) {
          cachedOrder.status = OrderStatus.CANCELLED;
          cachedOrder.updatedAt = new Date();
          this.ordersCache.set(orderId, cachedOrder);
        }

        logger.info('Order cancelled successfully', {
          component: 'ORDER_SERVICE',
          orderId,
        });
      } else {
        logger.warn('Order cancellation failed', {
          component: 'ORDER_SERVICE',
          orderId,
          response: response.data,
        });
      }

      return success;

    } catch (error) {
      logger.error('Failed to cancel order', {
        component: 'ORDER_SERVICE',
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Track order status
   */
  async trackOrder(orderId: string): Promise<Order | null> {
    try {
      // This will refresh the order details from Rohlik.cz
      const order = await this.getOrder(orderId);
      
      if (order) {
        logger.info('Order tracking updated', {
          component: 'ORDER_SERVICE',
          orderId,
          status: order.status,
          estimatedDelivery: order.estimatedDelivery,
        });
      }

      return order;

    } catch (error) {
      logger.error('Failed to track order', {
        component: 'ORDER_SERVICE',
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get available payment methods
   */
  private async getAvailablePaymentMethods(): Promise<string[]> {
    try {
      // Get checkout page to extract payment methods
      const response = await this.rohlikClient.get(this.CHECKOUT_URL);
      const $ = cheerio.load(response.data);

      const paymentMethods: string[] = [];

      // Parse payment method options
      $('input[name="payment_method"], select[name="payment_method"] option').each((_, element) => {
        const $element = $(element);
        const value = $element.val() as string;
        const text = $element.text() || $element.attr('data-label') || value;
        
        if (value && value !== '' && !paymentMethods.includes(value)) {
          paymentMethods.push(value);
        }
      });

      // Fallback payment methods if parsing fails
      if (paymentMethods.length === 0) {
        return ['card', 'cash', 'bank_transfer'];
      }

      return paymentMethods;

    } catch (error) {
      logger.warn('Failed to get payment methods, using defaults', {
        component: 'ORDER_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return ['card', 'cash', 'bank_transfer'];
    }
  }

  /**
   * Check inventory availability for cart items
   */
  private async checkInventoryAvailability(items: CartItem[]): Promise<{
    availableItems: string[];
    unavailableItems: string[];
  }> {
    const availableItems: string[] = [];
    const unavailableItems: string[] = [];

    // In a real implementation, this would check actual inventory
    // For now, we'll assume all items are available
    items.forEach(item => {
      availableItems.push(item.productId);
    });

    return { availableItems, unavailableItems };
  }

  /**
   * Submit order to Rohlik.cz
   */
  private async submitOrderToRohlik(
    items: CartItem[],
    deliveryAddress: DeliveryAddress,
    checkoutRequest: CheckoutRequest
  ): Promise<CheckoutResult> {
    try {
      // Get checkout page to extract form data
      const checkoutResponse = await this.rohlikClient.get(this.CHECKOUT_URL);
      const $ = cheerio.load(checkoutResponse.data);

      // Extract CSRF token
      const csrfToken = $('input[name="_token"]').val() as string;
      if (!csrfToken) {
        throw new Error('Could not extract CSRF token from checkout page');
      }

      // Prepare order data
      const orderData = new URLSearchParams({
        _token: csrfToken,
        payment_method: checkoutRequest.paymentMethod,
        delivery_slot_id: checkoutRequest.deliverySlotId || '',
        special_instructions: checkoutRequest.specialInstructions || '',
        confirm_inventory: checkoutRequest.confirmInventory ? '1' : '0',
      });

      // Add cart items to order data
      items.forEach((item, index) => {
        orderData.append(`items[${index}][product_id]`, item.productId);
        orderData.append(`items[${index}][quantity]`, item.quantity.toString());
      });

      // Submit order
      const submitResponse = await this.rohlikClient.post('/api/orders/submit', orderData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.rohlikClient['baseURL']}${this.CHECKOUT_URL}`,
        },
      });

      // Parse order confirmation
      if (submitResponse.status < 400) {
        const order = this.parseOrderConfirmation(submitResponse.data, items, deliveryAddress);
        
        if (order) {
          return {
            success: true,
            order,
            errors: [],
            confirmationUrl: `${this.rohlikClient['baseURL']}/objednavka/${order.id}`,
          };
        }
      }

      return {
        success: false,
        errors: ['Failed to submit order to Rohlik.cz'],
      };

    } catch (error) {
      logger.error('Failed to submit order to Rohlik.cz', {
        component: 'ORDER_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Failed to submit order'],
      };
    }
  }

  /**
   * Parse order confirmation from response
   */
  private parseOrderConfirmation(
    html: string,
    items: CartItem[],
    deliveryAddress: DeliveryAddress
  ): Order | null {
    try {
      const $ = cheerio.load(html);

      // Extract order information
      const orderNumber = $('.order-number, .cislo-objednavky').text().trim() || 
                         $('h1, h2').text().match(/\d+/)?.[0] ||
                         `ORD-${Date.now()}`;

      const orderId = orderNumber.replace(/\D/g, '') || Date.now().toString();

      // Convert cart items to order items
      const orderItems: OrderItem[] = items.map(item => ({
        productId: item.productId,
        productName: item.productName || 'Unknown Product',
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        totalPrice: (item.unitPrice || 0) * item.quantity,
        imageUrl: item.imageUrl,
      }));

      const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const deliveryFee = this.parsePrice($('.delivery-fee, .doprava-cena').text()) || 49;
      const total = subtotal + deliveryFee;

      const order: Order = {
        id: orderId,
        orderNumber,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: orderItems,
        subtotal,
        deliveryFee,
        total,
        deliveryAddress,
        estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 hours
      };

      return order;

    } catch (error) {
      logger.error('Failed to parse order confirmation', {
        component: 'ORDER_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Parse order history from HTML
   */
  private parseOrderHistory(html: string): Order[] {
    const $ = cheerio.load(html);
    const orders: Order[] = [];

    $('.order, .objednavka, [data-order-id]').each((_, element) => {
      const $order = $(element);
      
      const orderId = $order.attr('data-order-id') || 
                     $order.find('[data-order-id]').attr('data-order-id') ||
                     `order-${Date.now()}-${Math.random()}`;

      const orderNumber = $order.find('.order-number, .cislo').text().trim();
      const statusText = $order.find('.status, .stav').text().trim().toLowerCase();
      const status = this.parseOrderStatus(statusText);

      const totalText = $order.find('.total, .celkem, .cena').text().trim();
      const total = this.parsePrice(totalText);

      const dateText = $order.find('.date, .datum').text().trim();
      const createdAt = this.parseDate(dateText);

      if (orderId && orderNumber) {
        orders.push({
          id: orderId,
          orderNumber,
          status,
          createdAt,
          updatedAt: createdAt,
          items: [], // Will be filled when getting order details
          subtotal: total * 0.9, // Estimate
          deliveryFee: total * 0.1, // Estimate
          total,
          deliveryAddress: {
            street: '',
            houseNumber: '',
            city: '',
            postalCode: '',
            country: 'CZ',
          },
        });
      }
    });

    return orders;
  }

  /**
   * Parse order details from HTML
   */
  private parseOrderDetails(html: string, orderId: string): Order | null {
    try {
      const $ = cheerio.load(html);

      const orderNumber = $('.order-number, .cislo-objednavky').text().trim();
      const statusText = $('.status, .stav').text().trim().toLowerCase();
      const status = this.parseOrderStatus(statusText);

      // Parse order items
      const items: OrderItem[] = [];
      $('.order-item, .polozka').each((_, element) => {
        const $item = $(element);
        
        const productName = $item.find('.name, .nazev').text().trim();
        const quantity = parseInt($item.find('.quantity, .mnozstvi').text().trim()) || 1;
        const priceText = $item.find('.price, .cena').text().trim();
        const unitPrice = this.parsePrice(priceText);

        if (productName) {
          items.push({
            productId: `item-${items.length}`,
            productName,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
          });
        }
      });

      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const deliveryFeeText = $('.delivery-fee, .doprava').text().trim();
      const deliveryFee = this.parsePrice(deliveryFeeText) || 49;
      const total = subtotal + deliveryFee;

      const dateText = $('.order-date, .datum').text().trim();
      const createdAt = this.parseDate(dateText);

      return {
        id: orderId,
        orderNumber: orderNumber || orderId,
        status,
        createdAt,
        updatedAt: new Date(),
        items,
        subtotal,
        deliveryFee,
        total,
        deliveryAddress: {
          street: '',
          houseNumber: '',
          city: '',
          postalCode: '',
          country: 'CZ',
        },
      };

    } catch (error) {
      logger.error('Failed to parse order details', {
        component: 'ORDER_SERVICE',
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Parse order status from text
   */
  private parseOrderStatus(statusText: string): OrderStatus {
    const text = statusText.toLowerCase();
    
    if (text.includes('pending') || text.includes('čekající')) return OrderStatus.PENDING;
    if (text.includes('confirmed') || text.includes('potvrzeno')) return OrderStatus.CONFIRMED;
    if (text.includes('preparing') || text.includes('připravuje')) return OrderStatus.PREPARING;
    if (text.includes('shipped') || text.includes('expedováno')) return OrderStatus.SHIPPED;
    if (text.includes('delivered') || text.includes('doručeno')) return OrderStatus.DELIVERED;
    if (text.includes('cancelled') || text.includes('zrušeno')) return OrderStatus.CANCELLED;
    if (text.includes('failed') || text.includes('neúspěšné')) return OrderStatus.FAILED;
    
    return OrderStatus.PENDING;
  }

  /**
   * Parse price from Czech format
   */
  private parsePrice(priceText: string): number {
    if (!priceText) return 0;
    
    const cleanText = priceText.replace(/[^\d,.-]/g, '');
    const normalizedText = cleanText.replace(',', '.');
    const price = parseFloat(normalizedText);
    
    return isNaN(price) ? 0 : price;
  }

  /**
   * Parse date from Czech format
   */
  private parseDate(dateText: string): Date {
    if (!dateText) return new Date();
    
    // Try to parse Czech date format (DD.MM.YYYY)
    const czechDateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (czechDateMatch) {
      const [, day, month, year] = czechDateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Fallback to standard parsing
    const parsed = new Date(dateText);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}

// Export singleton instance
export const orderService = new OrderService(); 