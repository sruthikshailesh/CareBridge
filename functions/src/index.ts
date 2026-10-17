import { onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

export const healthCheck = onCall(() => ({
  status: "ok",
  time: Date.now(),
}));
