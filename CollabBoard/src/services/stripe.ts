import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

const createCheckoutFn = httpsCallable(functions, 'createCheckoutSession');
const createPortalFn = httpsCallable(functions, 'createPortalSession');

export async function redirectToCheckout(): Promise<void> {
  const origin = window.location.origin;
  const result = await createCheckoutFn({
    successUrl: `${origin}/checkout/success`,
    cancelUrl: `${origin}/checkout/cancel`,
  });

  const { url } = result.data as { url: string };
  if (url) {
    window.location.href = url;
  }
}

export async function redirectToPortal(): Promise<void> {
  const origin = window.location.origin;
  const result = await createPortalFn({
    returnUrl: `${origin}/dashboard`,
  });

  const { url } = result.data as { url: string };
  if (url) {
    window.location.href = url;
  }
}
