import { store, ProductType, Platform, Product } from 'capacitor-plugin-cdv-purchase';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

const PRODUCT_IDS = {
  PREMIUM_MONTHLY: 'com.estilovivo.app.premium.monthly',
  PREMIUM_YEARLY: 'com.estilovivo.app.premium.yearly',
  PREMIUM_LIFETIME: 'com.estilovivo.app.premium.lifetime',
};

let initialized = false;

export async function initBilling() {
  if (!isNative || initialized) return;

  try {
    store.register([
      {
        id: PRODUCT_IDS.PREMIUM_MONTHLY,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.GOOGLE_PLAY,
      },
      {
        id: PRODUCT_IDS.PREMIUM_YEARLY,
        type: ProductType.PAID_SUBSCRIPTION,
        platform: Platform.GOOGLE_PLAY,
      },
      {
        id: PRODUCT_IDS.PREMIUM_LIFETIME,
        type: ProductType.NON_CONSUMABLE,
        platform: Platform.GOOGLE_PLAY,
      },
    ]);

    store.when().productUpdated((product: Product) => {
      console.log('Product updated:', product.id, product.owned);
    });

    await new Promise<void>(resolve => store.ready(() => resolve()));
    initialized = true;
  } catch (e) {
    console.warn('Billing init failed:', e);
  }
}

export async function getProducts() {
  if (!isNative) return [];
  try {
    const products = store.products;
    return products.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.pricing?.price ?? '...',
      currency: p.pricing?.currency ?? '',
      type: p.type,
    }));
  } catch (e) {
    console.warn('Get products failed:', e);
    return [];
  }
}

export async function purchaseProduct(productId: string) {
  if (!isNative) return false;
  try {
    const product = store.get(productId);
    if (!product) return false;
    const offer = product.getOffer();
    if (!offer) return false;
    const error = await offer.order();
    return !error;
  } catch (e) {
    console.warn('Purchase failed:', e);
    return false;
  }
}

export async function restorePurchases() {
  if (!isNative) return false;
  try {
    const error = await store.restorePurchases();
    return !error;
  } catch (e) {
    console.warn('Restore failed:', e);
    return false;
  }
}

export async function checkPremiumStatus(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const products = store.products;
    return products.some(p =>
      p.id === PRODUCT_IDS.PREMIUM_LIFETIME && p.owned
    );
  } catch (e) {
    return false;
  }
}

export { PRODUCT_IDS };
