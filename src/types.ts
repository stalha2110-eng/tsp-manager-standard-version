export type ThemeType = 
  | 'midnight_blue' 
  | 'neo_brutalist' 
  | 'glass_modern' 
  | 'luxury_gold' 
  | 'emerald_matrix'
  | 'premium_dynamic'
  | 'ultra_premium';

export type LanguageType = 'en' | 'hi' | 'mr' | 'hi-en';

export interface Translations {
  en: string;
  hi: string;
  mr: string;
  'hi-en': string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

export interface UdharBillItem {
  id: string;
  name: string;
  quantity: number;
  priceUnit: number;
  total: number;
}

export interface Note {
  id: string;
  title: string;
  description: string;
  category: 'Stock' | 'Payment' | 'Customer' | 'Supplier' | 'Reminder' | 'General' | 'Udhar';
  priority: 'Urgent' | 'Important' | 'Completed' | 'Info';
  createdAt: string;
  dueDate: string | null;
  status: 'Active' | 'Completed';
  isPinned: boolean;
  
  // Advanced Udhar (Debt/Credit ledger) fields
  udharAmount?: number;
  udharType?: 'give' | 'take'; // 'give' (lent - we will receive), 'take' (borrowed - we have to pay)
  udharPerson?: string;
  udharPhone?: string; // WhatsApp & calling number
  udharSettled?: boolean;
  udharPayments?: { id: string; date: string; amount: number; description?: string }[];
  udharItems?: UdharBillItem[];
}

export interface Item {
  id: string;
  name: string;
  translations: Translations;
  categoryId: string;
  quantity: number;
  unit: string;
  buyingPrice: number;
  buyingPriceUnit: string;
  wholesalePrice: number;
  wholesalePriceUnit: string;
  retailPrice: number;
  retailPriceUnit: string;
  lastUpdated: string;
  priceChangedAt?: string;
  lastChangedBy?: string;
  notes?: string;
  aiAdvice?: string;
}

export interface AppSettings {
  theme: ThemeType;
  language: LanguageType;
  isLocked: boolean;
  pin: string | null;
  currency: string;
  autoLockDelay: number; // in seconds
  hideBuyingPriceByDefault: boolean;
  accentColor: 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'slate';
  fontSize: 'standard' | 'comfortable' | 'compact';
  pricePrecision: number;
  showStockAlerts: boolean;
  autoCloudSync: boolean;
  hasSeenOnboarding: boolean;
  enableBgColorChange?: boolean;
  ultraPremiumSpeed?: 'static' | 'slow' | 'normal' | 'fast' | 'ultra_fast';
  ultraPremiumPalette?: 'sunset' | 'deep_sea' | 'matrix' | 'cosmic_orchid' | 'cyberpunk_gold' | 'neon_aurora';
  dismissedNotifications: string[];
  deviceId: string;
  deviceName: string;
  storeName?: string;
  storeOwnerName?: string;
  phoneNumber?: string;
  storeAddress?: string;
  hapticMaster?: boolean;
  hapticNavigation?: boolean;
  hapticCalculator?: boolean;
  hapticBilling?: boolean;
  hapticButton?: boolean;
  hapticSave?: boolean;
  hapticDownload?: boolean;
  hapticPopup?: boolean;
  hapticLongPress?: boolean;
  hapticError?: boolean;
  hapticSuccess?: boolean;
  hapticIntensity?: 'very_light' | 'light' | 'medium' | 'strong';
}

export interface AppState {
  items: Item[];
  notes: Note[];
  categories: Category[];
  settings: AppSettings;
  user: {
    uid: string;
    email: string | null;
  } | null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

