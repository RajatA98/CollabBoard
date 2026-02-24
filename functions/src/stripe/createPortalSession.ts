import * as admin from "firebase-admin";
import Stripe from "stripe";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

/** Resolve Stripe secret; use .env when running in emulator. */
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

export const createPortalSession = onCall(
  {
    secrets: [stripeSecretKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const {returnUrl} = request.data as {returnUrl?: string};

    const firestore = admin.firestore();
    const userRef = firestore.doc(`users/${uid}`);
    let userSnap = await userRef.get();

    // Create user profile if missing so we don't throw "User profile not found"
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
      throw new HttpsError("not-found", "User profile not found.");
    }
    const customerId = userData.stripeCustomerId as string | undefined;

    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No Stripe customer found. You may not have an active subscription."
      );
    }

    const stripe = new Stripe(getStripeSecret());

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || "{CHECKOUT_SESSION_URL}/dashboard",
    });

    return {url: session.url};
  }
);
