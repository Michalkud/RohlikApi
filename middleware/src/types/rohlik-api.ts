import { z } from 'zod';

// Base types
export const RohlikProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  originalPrice: z.number().optional(),
  discount: z.number().optional(),
  unit: z.string(),
  unitPrice: z.number(),
  unitType: z.string(),
  weight: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  inStock: z.boolean().default(true),
  minQuantity: z.number().default(1),
  maxQuantity: z.number().optional(),
});

export const RohlikCartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  price: z.number(),
  totalPrice: z.number(),
});

export const RohlikCartSchema = z.object({
  items: z.array(RohlikCartItemSchema),
  totalItems: z.number(),
  totalPrice: z.number(),
  currency: z.string().default('CZK'),
  minimumOrderValue: z.number().default(749),
  deliveryFee: z.number().default(0),
});

export const RohlikAddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string().default('CZ'),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});

export const RohlikDeliverySlotSchema = z.object({
  id: z.string(),
  date: z.string(),
  timeFrom: z.string(),
  timeTo: z.string(),
  available: z.boolean(),
  price: z.number(),
});

export const RohlikUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  addresses: z.array(RohlikAddressSchema).default([]),
});

export const RohlikOrderSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled']),
  items: z.array(RohlikCartItemSchema),
  totalPrice: z.number(),
  deliveryAddress: RohlikAddressSchema,
  deliverySlot: RohlikDeliverySlotSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

// API Response types
export const RohlikApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Authentication types
export const RohlikAuthRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RohlikAuthResponseSchema = z.object({
  success: z.boolean(),
  user: RohlikUserSchema.optional(),
  sessionId: z.string().optional(),
  error: z.string().optional(),
});

// Product search types
export const RohlikProductSearchRequestSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'price', 'popularity']).default('popularity'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const RohlikProductSearchResponseSchema = z.object({
  products: z.array(RohlikProductSchema),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

// Cart operation types
export const RohlikAddToCartRequestSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1).default(1),
});

export const RohlikUpdateCartItemRequestSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(0), // 0 to remove item
});

// Location types
export const RohlikLocationRequestSchema = z.object({
  address: z.string(),
});

export const RohlikLocationResponseSchema = z.object({
  address: RohlikAddressSchema,
  deliveryAvailable: z.boolean(),
  deliverySlots: z.array(RohlikDeliverySlotSchema),
});

// Export inferred types
export type RohlikProduct = z.infer<typeof RohlikProductSchema>;
export type RohlikCartItem = z.infer<typeof RohlikCartItemSchema>;
export type RohlikCart = z.infer<typeof RohlikCartSchema>;
export type RohlikAddress = z.infer<typeof RohlikAddressSchema>;
export type RohlikDeliverySlot = z.infer<typeof RohlikDeliverySlotSchema>;
export type RohlikUser = z.infer<typeof RohlikUserSchema>;
export type RohlikOrder = z.infer<typeof RohlikOrderSchema>;
export type RohlikApiResponse = z.infer<typeof RohlikApiResponseSchema>;
export type RohlikAuthRequest = z.infer<typeof RohlikAuthRequestSchema>;
export type RohlikAuthResponse = z.infer<typeof RohlikAuthResponseSchema>;
export type RohlikProductSearchRequest = z.infer<typeof RohlikProductSearchRequestSchema>;
export type RohlikProductSearchResponse = z.infer<typeof RohlikProductSearchResponseSchema>;
export type RohlikAddToCartRequest = z.infer<typeof RohlikAddToCartRequestSchema>;
export type RohlikUpdateCartItemRequest = z.infer<typeof RohlikUpdateCartItemRequestSchema>;
export type RohlikLocationRequest = z.infer<typeof RohlikLocationRequestSchema>;
export type RohlikLocationResponse = z.infer<typeof RohlikLocationResponseSchema>;

// Known product IDs from our reverse engineering
export const KNOWN_PRODUCT_IDS = {
  SUTCHA_PRIME_RUMP_STEAK: '1440986',
  FJORU_ASC_KREVETY: '1412825',
  MELOUN_VODNI_CERVENY: '1354611',
  OKURKA_HADOVKA: '1294559',
  LEDOVY_SALAT: '1287919',
  DUBLIN_DAIRY_CHEDDAR: '1326593',
  MONSTER_ENERGY: '1295189',
} as const; 