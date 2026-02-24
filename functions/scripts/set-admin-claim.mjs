/**
 * Set the Firebase Auth custom claim `admin: true` for a user.
 * That user then gets Pro-style AI access (no daily limit) without paying.
 *
 * Usage (from functions/): node scripts/set-admin-claim.mjs <uid>
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or gcloud auth application-default login.
 * The user must sign out and sign back in (or refresh the ID token) for the claim to take effect.
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getProjectId() {
  if (process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID) {
    return process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const firebasercPath = join(__dirname, "..", "..", ".firebaserc");
    const rc = JSON.parse(readFileSync(firebasercPath, "utf8"));
    return rc.projects?.default;
  } catch {
    return null;
  }
}

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node set-admin-claim.mjs <uid>");
  process.exit(1);
}

const projectId = getProjectId();
if (!admin.apps.length) {
  admin.initializeApp(projectId ? { projectId } : {});
}

async function main() {
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log("Set custom claim admin: true for uid:", uid);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
