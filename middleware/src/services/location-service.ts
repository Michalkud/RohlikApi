import { logger } from '../utils/logger.js';
import { RohlikClient } from '../clients/rohlik-client.js';
import { authService } from './auth-service.js';
import * as cheerio from 'cheerio';

export interface DeliveryAddress {
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  district?: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface DeliverySlot {
  id: string;
  date: string; // YYYY-MM-DD
  timeFrom: string; // HH:MM
  timeTo: string; // HH:MM
  available: boolean;
  price: number;
  isExpress: boolean;
  description?: string;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: DeliveryAddress;
  openingHours: string;
  available: boolean;
  distance?: number; // in km
}

export interface LocationValidationResult {
  isValid: boolean;
  deliveryAvailable: boolean;
  suggestedAddress?: DeliveryAddress;
  errors: string[];
  deliveryFee?: number;
  minOrderValue?: number;
}

export interface DeliveryArea {
  postalCode: string;
  city: string;
  available: boolean;
  deliveryFee: number;
  minOrderValue: number;
  expressAvailable: boolean;
}

class LocationService {
  private rohlikClient: RohlikClient;
  private currentAddress: DeliveryAddress | null = null;
  private deliveryAreasCache: Map<string, DeliveryArea> = new Map();
  private readonly LOCATION_URL = '/adresa';
  private readonly DELIVERY_SLOTS_URL = '/doruceni';
  private readonly PICKUP_POINTS_URL = '/vyzvedni';

  constructor() {
    this.rohlikClient = new RohlikClient();
  }

  /**
   * Set delivery address with validation
   */
  async setDeliveryAddress(address: DeliveryAddress): Promise<LocationValidationResult> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to set delivery address');
      }

      logger.info('Setting delivery address', {
        component: 'LOCATION_SERVICE',
        city: address.city,
        postalCode: address.postalCode,
      });

      // Validate address format
      const formatValidation = this.validateAddressFormat(address);
      if (!formatValidation.isValid) {
        return formatValidation;
      }

      // Check delivery availability for the area
      const areaValidation = await this.validateDeliveryArea(address);
      if (!areaValidation.isValid) {
        return areaValidation;
      }

      // Submit address to Rohlik.cz
      const submissionResult = await this.submitAddressToRohlik(address);
      if (submissionResult.isValid) {
        this.currentAddress = address;
        
        logger.info('Delivery address set successfully', {
          component: 'LOCATION_SERVICE',
          city: address.city,
          deliveryFee: submissionResult.deliveryFee,
        });
      }

      return submissionResult;

    } catch (error) {
      logger.error('Failed to set delivery address', {
        component: 'LOCATION_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
        address: `${address.city}, ${address.postalCode}`,
      });

      return {
        isValid: false,
        deliveryAvailable: false,
        errors: [error instanceof Error ? error.message : 'Failed to set delivery address'],
      };
    }
  }

  /**
   * Get current delivery address
   */
  getCurrentAddress(): DeliveryAddress | null {
    return this.currentAddress ? { ...this.currentAddress } : null;
  }

  /**
   * Get available delivery slots
   */
  async getDeliverySlots(date?: string): Promise<DeliverySlot[]> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to get delivery slots');
      }

      if (!this.currentAddress) {
        throw new Error('Delivery address must be set before getting delivery slots');
      }

      logger.info('Fetching delivery slots', {
        component: 'LOCATION_SERVICE',
        date,
        city: this.currentAddress.city,
      });

      // Get delivery slots page from Rohlik.cz
      const url = date ? `${this.DELIVERY_SLOTS_URL}?date=${date}` : this.DELIVERY_SLOTS_URL;
      const response = await this.rohlikClient.get(url);
      
      const slots = this.parseDeliverySlots(response.data, date);

      logger.info('Delivery slots fetched successfully', {
        component: 'LOCATION_SERVICE',
        slotsCount: slots.length,
        date,
      });

      return slots;

    } catch (error) {
      logger.error('Failed to get delivery slots', {
        component: 'LOCATION_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
        date,
      });
      return [];
    }
  }

  /**
   * Book a delivery slot
   */
  async bookDeliverySlot(slotId: string): Promise<boolean> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to book delivery slot');
      }

      logger.info('Booking delivery slot', {
        component: 'LOCATION_SERVICE',
        slotId,
      });

      // Submit slot booking to Rohlik.cz
      const response = await this.rohlikClient.post('/api/delivery/book', {
        slotId,
      });

      const success = response.status === 200 && response.data?.success === true;

      if (success) {
        logger.info('Delivery slot booked successfully', {
          component: 'LOCATION_SERVICE',
          slotId,
        });
      } else {
        logger.warn('Delivery slot booking failed', {
          component: 'LOCATION_SERVICE',
          slotId,
          response: response.data,
        });
      }

      return success;

    } catch (error) {
      logger.error('Failed to book delivery slot', {
        component: 'LOCATION_SERVICE',
        slotId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get nearby pickup points
   */
  async getPickupPoints(): Promise<PickupPoint[]> {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('User must be authenticated to get pickup points');
      }

      logger.info('Fetching pickup points', {
        component: 'LOCATION_SERVICE',
        currentCity: this.currentAddress?.city,
      });

      // Get pickup points page from Rohlik.cz
      const response = await this.rohlikClient.get(this.PICKUP_POINTS_URL);
      const pickupPoints = this.parsePickupPoints(response.data);

      logger.info('Pickup points fetched successfully', {
        component: 'LOCATION_SERVICE',
        pointsCount: pickupPoints.length,
      });

      return pickupPoints;

    } catch (error) {
      logger.error('Failed to get pickup points', {
        component: 'LOCATION_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Calculate delivery fee for current address
   */
  async calculateDeliveryFee(): Promise<number> {
    try {
      if (!this.currentAddress) {
        return 0;
      }

      const deliveryArea = await this.getDeliveryArea(this.currentAddress.postalCode);
      return deliveryArea?.deliveryFee || 0;

    } catch (error) {
      logger.error('Failed to calculate delivery fee', {
        component: 'LOCATION_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Validate address format
   */
  private validateAddressFormat(address: DeliveryAddress): LocationValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!address.street?.trim()) {
      errors.push('Street name is required');
    }

    if (!address.houseNumber?.trim()) {
      errors.push('House number is required');
    }

    if (!address.city?.trim()) {
      errors.push('City is required');
    }

    if (!address.postalCode?.trim()) {
      errors.push('Postal code is required');
    } else {
      // Czech postal code format: XXXXX (5 digits)
      const postalCodeRegex = /^\d{5}$/;
      if (!postalCodeRegex.test(address.postalCode.replace(/\s/g, ''))) {
        errors.push('Invalid Czech postal code format (should be 5 digits)');
      }
    }

    if (!address.country?.trim()) {
      errors.push('Country is required');
    } else if (address.country.toLowerCase() !== 'czechia' && 
               address.country.toLowerCase() !== 'czech republic' &&
               address.country.toLowerCase() !== 'cz') {
      errors.push('Delivery is only available in Czech Republic');
    }

    return {
      isValid: errors.length === 0,
      deliveryAvailable: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate delivery area availability
   */
  private async validateDeliveryArea(address: DeliveryAddress): Promise<LocationValidationResult> {
    try {
      const deliveryArea = await this.getDeliveryArea(address.postalCode);
      
      if (!deliveryArea) {
        return {
          isValid: false,
          deliveryAvailable: false,
          errors: ['Delivery not available in this area'],
        };
      }

      if (!deliveryArea.available) {
        return {
          isValid: false,
          deliveryAvailable: false,
          errors: ['Delivery temporarily unavailable in this area'],
        };
      }

      return {
        isValid: true,
        deliveryAvailable: true,
        errors: [],
        deliveryFee: deliveryArea.deliveryFee,
        minOrderValue: deliveryArea.minOrderValue,
      };

    } catch (error) {
      return {
        isValid: false,
        deliveryAvailable: false,
        errors: ['Failed to validate delivery area'],
      };
    }
  }

  /**
   * Submit address to Rohlik.cz
   */
  private async submitAddressToRohlik(address: DeliveryAddress): Promise<LocationValidationResult> {
    try {
      // Get the location page to extract form data
      const locationResponse = await this.rohlikClient.get(this.LOCATION_URL);
      const $ = cheerio.load(locationResponse.data);

      // Extract CSRF token and form action
      const csrfToken = $('input[name="_token"]').val() as string;
      const formAction = $('form[action*="adresa"]').attr('action') || this.LOCATION_URL;

      if (!csrfToken) {
        throw new Error('Could not extract CSRF token from location page');
      }

      // Prepare address data
      const addressData = new URLSearchParams({
        street: address.street,
        house_number: address.houseNumber,
        city: address.city,
        postal_code: address.postalCode.replace(/\s/g, ''),
        district: address.district || '',
        country: 'CZ',
        _token: csrfToken,
      });

      // Submit address
      const submitResponse = await this.rohlikClient.post(formAction, addressData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.rohlikClient['baseURL']}${this.LOCATION_URL}`,
        },
      });

      // Check if submission was successful
      const isSuccess = submitResponse.status < 400;
      
      if (isSuccess) {
        // Parse delivery fee from response if available
        const responseHtml = cheerio.load(submitResponse.data);
        const deliveryFeeText = responseHtml('.delivery-fee, .doprava-cena').text();
        const deliveryFee = this.parsePrice(deliveryFeeText);

        return {
          isValid: true,
          deliveryAvailable: true,
          errors: [],
          deliveryFee,
        };
      } else {
        return {
          isValid: false,
          deliveryAvailable: false,
          errors: ['Failed to set address on Rohlik.cz'],
        };
      }

    } catch (error) {
      logger.error('Failed to submit address to Rohlik.cz', {
        component: 'LOCATION_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
        deliveryAvailable: false,
        errors: ['Failed to submit address'],
      };
    }
  }

  /**
   * Get delivery area information
   */
  private async getDeliveryArea(postalCode: string): Promise<DeliveryArea | null> {
    try {
      // Check cache first
      const cached = this.deliveryAreasCache.get(postalCode);
      if (cached) {
        return cached;
      }

      // Fetch delivery area info from Rohlik.cz
      const response = await this.rohlikClient.get(`/api/delivery-areas/${postalCode}`);
      
      if (response.status === 200 && response.data) {
        const deliveryArea: DeliveryArea = {
          postalCode,
          city: response.data.city || '',
          available: response.data.available || false,
          deliveryFee: response.data.deliveryFee || 0,
          minOrderValue: response.data.minOrderValue || 0,
          expressAvailable: response.data.expressAvailable || false,
        };

        // Cache the result
        this.deliveryAreasCache.set(postalCode, deliveryArea);
        return deliveryArea;
      }

      return null;

    } catch (error) {
      // Fallback: assume Prague area is available
      if (postalCode.startsWith('1')) {
        const fallbackArea: DeliveryArea = {
          postalCode,
          city: 'Praha',
          available: true,
          deliveryFee: 49,
          minOrderValue: 500,
          expressAvailable: true,
        };
        
        this.deliveryAreasCache.set(postalCode, fallbackArea);
        return fallbackArea;
      }

      return null;
    }
  }

  /**
   * Parse delivery slots from HTML
   */
  private parseDeliverySlots(html: string, requestedDate?: string): DeliverySlot[] {
    const $ = cheerio.load(html);
    const slots: DeliverySlot[] = [];

    $('.delivery-slot, .slot, [data-slot-id]').each((index, element) => {
      const $slot = $(element);
      
      const id = $slot.attr('data-slot-id') || 
                $slot.find('[data-slot-id]').attr('data-slot-id') ||
                `slot-${index}`;

      const dateText = $slot.find('.date, .slot-date').text().trim() ||
                     requestedDate ||
                     new Date().toISOString().split('T')[0];

      const timeText = $slot.find('.time, .slot-time').text().trim();
      const [timeFrom, timeTo] = this.parseTimeRange(timeText);

      const priceText = $slot.find('.price, .slot-price').text().trim();
      const price = this.parsePrice(priceText);

      const available = !$slot.hasClass('disabled') && 
                       !$slot.hasClass('unavailable') &&
                       !$slot.find('.disabled, .unavailable').length;

      const isExpress = $slot.hasClass('express') || 
                       $slot.find('.express').length > 0 ||
                       timeText.includes('express');

      const description = $slot.find('.description, .slot-description').text().trim();

      if (id && timeFrom && timeTo) {
        slots.push({
          id,
          date: dateText,
          timeFrom,
          timeTo,
          available,
          price,
          isExpress,
          description: description || undefined,
        });
      }
    });

    return slots;
  }

  /**
   * Parse pickup points from HTML
   */
  private parsePickupPoints(html: string): PickupPoint[] {
    const $ = cheerio.load(html);
    const points: PickupPoint[] = [];

    $('.pickup-point, .vyzvedni-misto, [data-pickup-id]').each((index, element) => {
      const $point = $(element);
      
      const id = $point.attr('data-pickup-id') || 
                $point.find('[data-pickup-id]').attr('data-pickup-id') ||
                `pickup-${index}`;

      const name = $point.find('.name, .pickup-name, h3, h4').text().trim();
      
      const addressText = $point.find('.address, .pickup-address').text().trim();
      const address = this.parseAddressFromText(addressText);

      const openingHours = $point.find('.hours, .opening-hours').text().trim();
      
      const available = !$point.hasClass('disabled') && 
                       !$point.hasClass('unavailable');

      const distanceText = $point.find('.distance').text().trim();
      const distance = distanceText ? parseFloat(distanceText.replace(/[^\d.]/g, '')) : undefined;

      if (id && name && address) {
        points.push({
          id,
          name,
          address,
          openingHours: openingHours || 'Not specified',
          available,
          distance,
        });
      }
    });

    return points;
  }

  /**
   * Parse time range from text (e.g., "14:00 - 16:00")
   */
  private parseTimeRange(timeText: string): [string, string] {
    const timeRegex = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/;
    const match = timeText.match(timeRegex);
    
    if (match) {
      const timeFrom = `${match[1].padStart(2, '0')}:${match[2]}`;
      const timeTo = `${match[3].padStart(2, '0')}:${match[4]}`;
      return [timeFrom, timeTo];
    }
    
    return ['09:00', '18:00']; // Default fallback
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
   * Parse address from text
   */
  private parseAddressFromText(addressText: string): DeliveryAddress | null {
    if (!addressText) return null;

    // Simple parsing - in real implementation, this would be more sophisticated
    const parts = addressText.split(',').map(part => part.trim());
    
    if (parts.length >= 2) {
      return {
        street: parts[0] || '',
        houseNumber: '',
        city: parts[parts.length - 1] || '',
        postalCode: '',
        country: 'CZ',
      };
    }

    return null;
  }
}

// Export singleton instance
export const locationService = new LocationService(); 