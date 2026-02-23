/**
 * Creates a Stripe Checkout Session for upgrading to CollabBoard Pro.
 *
 * MANUAL SETUP REQUIRED:
 * 1. Create a Product named "CollabBoard Pro" in Stripe Dashboard
 * 2. Add a recurring Price of $9.99/month to that Product
 * 3. Copy the Price ID (e.g. price_xxx) into STRIPE_PRO_PRICE_ID env/secret
 * 4. Set STRIPE_SECRET_KEY to your Stripe secret key
 * 5. Set up the webhook endpoint in Stripe Dashboard pointing to the
 *    deployed `stripeWebhook` Cloud Function URL
 * 6. Configure the Stripe Customer Portal in Dashboard (enable payment
 *    method updates, cancellation, invoice history)
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripePriceId = defineSecret("STRIPE_PRO_PRICE_ID");

/** Resolve Stripe secret; use .env when running in emulator (secrets not loaded from repo .env). */
function getStripeSecret(): string {
  try {
    const v = stripeSecretKey.value();
    if (v) return v;
  } catch {
    // Emulator may not have secret; fall back to process.env
  }
  const env = process.env.STRIPE_SECRET_KEY;
  if (env) return env;
  throw new HttpsError(
    "failed-precondition",
    "Stripe is not configured. Set STRIPE_SECRET_KEY in .env (local) or Secret Manager (deployed)."
  );
}

/** Resolve price ID; use Secret Manager in production, .env in emulator. */
function getPriceId(): string {
  try {
    const v = stripePriceId.value();
    if (v) return v;
  } catch {
    // Emulator may not have secret; fall back to process.env
  }
  const env = process.env.STRIPE_PRO_PRICE_ID;
  if (env) return env;
  return "";
}

export const createCheckoutSession = onCall(
  {
    secrets: [stripeSecretKey, stripePriceId],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const {successUrl, cancelUrl} = request.data as {
      successUrl?: string;
      cancelUrl?: string;
    };

    const stripe = new Stripe(getStripeSecret());
    const firestore = admin.firestore();
    const userRef = firestore.doc(`users/${uid}`);
    let userSnap = await userRef.get();

    // Create user profile if missing (e.g. test user or first time opening Profile before ensureUserDoc ran)
    if (!userSnap.exists) {
      const now = Date.now();
      const email = (request.auth.token.email as string) ?? "";
      const displayName = (request.auth.token.name as string) ?? "";
      await userRef.set({
        email,
        displayName,
        subscriptionTier: "free",
        aiCommandCount: 0,
        lastResetAt: now,
        createdAt: now,
      });
      userSnap = await userRef.get();
    }

    const userData = userSnap.data();
    if (!userData) {
      throw new HttpsError("not-found", "User profile not found. Please reload and try again.");
    }

    if (userData.subscriptionTier === "pro") {
      throw new HttpsError(
        "already-exists",
        "You already have an active Pro subscription."
      );
    }

    let customerId = userData.stripeCustomerId as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.email || request.auth.token.email || "",
        name: userData.displayName || "",
        metadata: {firebaseUID: uid},
      });
      customerId = customer.id;
      await userRef.update({stripeCustomerId: customerId});
    }

    const priceId = getPriceId();
    if (!priceId) {
      throw new HttpsError(
        "failed-precondition",
        "Stripe price not configured. Contact support."
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{price: priceId, quantity: 1}],
      success_url: successUrl || "{CHECKOUT_SESSION_URL}/checkout/success",
      cancel_url: cancelUrl || "{CHECKOUT_SESSION_URL}/checkout/cancel",
      metadata: {firebaseUID: uid},
      subscription_data: {
        metadata: {firebaseUID: uid},
      },
    });

    return {url: session.url};
  }
);
