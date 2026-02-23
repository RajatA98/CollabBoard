import * as admin from "firebase-admin";
import Stripe from "stripe";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

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
    const userSnap = await firestore.doc(`users/${uid}`).get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data()!;
    const customerId = userData.stripeCustomerId as string | undefined;

    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No Stripe customer found. You may not have an active subscription."
      );
    }

    const stripe = new Stripe(stripeSecretKey.value());

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || "{CHECKOUT_SESSION_URL}/dashboard",
    });

    return {url: session.url};
  }
);
