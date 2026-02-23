import * as admin from "firebase-admin";
import Stripe from "stripe";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

/**
 * Finds the Firebase UID for a Stripe customer by looking up the customer
 * metadata or searching Firestore by stripeCustomerId.
 */
async function resolveFirebaseUID(
  stripe: Stripe,
  customerId: string
): Promise<string | null> {
  // Try customer metadata first
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted && customer.metadata?.firebaseUID) {
    return customer.metadata.firebaseUID;
  }

  // Fallback: query Firestore
  const snap = await admin
    .firestore()
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  return null;
}

/**
 * Extract the period end from a subscription. In Stripe SDK v20+,
 * current_period_end lives on individual subscription items, not the
 * subscription itself.
 */
function getPeriodEndMs(subscription: Stripe.Subscription): number | null {
  const items = subscription.items?.data;
  if (items && items.length > 0) {
    const end = items[0].current_period_end;
    if (typeof end === "number") {
      return end * 1000;
    }
  }
  return null;
}

export const stripeWebhook = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecret],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const stripe = new Stripe(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", message);
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    const firestore = admin.firestore();

    try {
      switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid =
            session.metadata?.firebaseUID ||
            (session.customer
              ? await resolveFirebaseUID(
                stripe,
                  session.customer as string
              )
              : null);

        if (!uid) {
          console.error(
            "checkout.session.completed: could not resolve UID",
            session.id
          );
          break;
        }

        let periodEnd: number | null = null;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          periodEnd = getPeriodEndMs(subscription);
        }

        await firestore.doc(`users/${uid}`).update({
          subscriptionTier: "pro",
          subscriptionStatus: "active",
          aiCommandCount: 0,
          lastResetAt: Date.now(),
          ...(periodEnd && {currentPeriodEnd: periodEnd}),
        });

        console.log(`User ${uid} upgraded to Pro`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data
          .object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const uid = await resolveFirebaseUID(stripe, customerId);

        if (!uid) {
          console.error(
            "subscription.updated: could not resolve UID for customer",
            customerId
          );
          break;
        }

        const status = subscription.cancel_at_period_end
          ? "canceling"
          : subscription.status === "active"
            ? "active"
            : subscription.status === "past_due"
              ? "past_due"
              : "active";

        const periodEnd = getPeriodEndMs(subscription);

        await firestore.doc(`users/${uid}`).update({
          subscriptionStatus: status,
          ...(periodEnd !== null && {currentPeriodEnd: periodEnd}),
        });

        console.log(
          `User ${uid} subscription updated: ${status}`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data
          .object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const uid = await resolveFirebaseUID(stripe, customerId);

        if (!uid) {
          console.error(
            "subscription.deleted: could not resolve UID for customer",
            customerId
          );
          break;
        }

        await firestore.doc(`users/${uid}`).update({
          subscriptionTier: "free",
          subscriptionStatus: "expired",
          currentPeriodEnd: admin.firestore.FieldValue.delete(),
        });

        console.log(`User ${uid} downgraded to Free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const uid = await resolveFirebaseUID(stripe, customerId);

        if (!uid) {
          console.error(
            "invoice.payment_failed: could not resolve UID for customer",
            customerId
          );
          break;
        }

        await firestore.doc(`users/${uid}`).update({
          subscriptionStatus: "past_due",
        });

        console.log(`User ${uid} payment failed — marked past_due`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      console.error("Error processing webhook event:", err);
      res.status(500).send("Internal error");
      return;
    }

    res.status(200).json({received: true});
  }
);
