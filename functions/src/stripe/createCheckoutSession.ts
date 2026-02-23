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
import {defineSecret, defineString} from "firebase-functions/params";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripePriceId = defineString("STRIPE_PRO_PRICE_ID", {
  default: "",
});

export const createCheckoutSession = onCall(
  {
    secrets: [stripeSecretKey],
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

    const stripe = new Stripe(stripeSecretKey.value());
    const firestore = admin.firestore();
    const userRef = firestore.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError(
        "not-found",
        "User profile not found. Please reload and try again."
      );
    }

    const userData = userSnap.data()!;

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

    const priceId = stripePriceId.value();
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
