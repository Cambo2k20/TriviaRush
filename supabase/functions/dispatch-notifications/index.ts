import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

type Delivery = {
  delivery_id: string;
  notification_id: string;
  channel: "push" | "email";
  recipient_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  push_subscription_id: string | null;
  push_endpoint: string | null;
  push_p256dh: string | null;
  push_auth_secret: string | null;
  attempt_count: number;
  expires_at: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@example.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFICATION_FROM_EMAIL = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "";
const SITE_URL = new URL(Deno.env.get("SITE_URL") ?? "https://cambo2k20.github.io/TriviaRush/");
const CRON_SECRET = Deno.env.get("NOTIFICATION_DISPATCH_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-dispatch-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

async function authenticateUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

function notificationUrl(data: Record<string, unknown>) {
  const url = new URL(SITE_URL);
  if (typeof data.challenge === "string") {
    url.searchParams.set("challenge", data.challenge);
  } else if (typeof data.duel === "string") {
    url.searchParams.set("duel", data.duel);
  } else {
    url.searchParams.set("social", typeof data.view === "string" ? data.view : "notifications");
  }
  return url.toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function markDelivery(
  deliveryId: string,
  success: boolean,
  error: string | null = null,
  permanentFailure = false,
  deactivateSubscription = false
) {
  const { error: rpcError } = await admin.rpc("complete_notification_delivery", {
    p_delivery_id: deliveryId,
    p_success: success,
    p_error: error,
    p_permanent_failure: permanentFailure,
    p_deactivate_subscription: deactivateSubscription
  });
  if (rpcError) throw rpcError;
}

async function sendPush(delivery: Delivery) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    await markDelivery(delivery.delivery_id, false, "VAPID keys are not configured");
    return;
  }
  if (!delivery.push_endpoint || !delivery.push_p256dh || !delivery.push_auth_secret) {
    await markDelivery(delivery.delivery_id, false, "Push subscription is incomplete", true);
    return;
  }

  const expiresAt = delivery.expires_at ? Date.parse(delivery.expires_at) : Number.NaN;
  const ttl = Number.isFinite(expiresAt)
    ? Math.min(60 * 60 * 24 * 3, Math.floor((expiresAt - Date.now()) / 1000))
    : 60 * 60 * 24 * 3;
  if (ttl <= 0) {
    await markDelivery(delivery.delivery_id, false, "Notification expired before delivery", true);
    return;
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({
    title: delivery.title,
    body: delivery.body,
    url: notificationUrl(delivery.data || {}),
    tag: `trivia-rush:${delivery.notification_id}`,
    renotify: false
  });

  try {
    await webpush.sendNotification({
      endpoint: delivery.push_endpoint,
      keys: {
        p256dh: delivery.push_p256dh,
        auth: delivery.push_auth_secret
      }
    }, payload, { TTL: ttl });
    await markDelivery(delivery.delivery_id, true);
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
    const permanent = statusCode === 404 || statusCode === 410;
    await markDelivery(
      delivery.delivery_id,
      false,
      error instanceof Error ? error.message : String(error),
      permanent,
      permanent
    );
  }
}

async function sendEmail(delivery: Delivery) {
  const expiresAt = delivery.expires_at ? Date.parse(delivery.expires_at) : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    await markDelivery(delivery.delivery_id, false, "Notification expired before delivery", true);
    return;
  }

  if (!RESEND_API_KEY || !NOTIFICATION_FROM_EMAIL) {
    await markDelivery(delivery.delivery_id, false, "Email provider is not configured", true);
    return;
  }

  const { data, error } = await admin.auth.admin.getUserById(delivery.recipient_id);
  const email = data.user?.email;
  if (error || !email || !data.user.email_confirmed_at) {
    await markDelivery(delivery.delivery_id, false, "Recipient has no verified email", true);
    return;
  }

  const openUrl = notificationUrl(delivery.data || {});
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: NOTIFICATION_FROM_EMAIL,
      to: [email],
      subject: delivery.title,
      html: [
        '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px">',
        `<h1 style="color:#111936">${escapeHtml(delivery.title)}</h1>`,
        `<p>${escapeHtml(delivery.body)}</p>`,
        `<p><a href="${escapeHtml(openUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111936;color:#fff;text-decoration:none">Open Trivia Rush</a></p>`,
        '<p style="color:#667;font-size:12px">You can change notification preferences inside Trivia Rush.</p>',
        "</div>"
      ].join("")
    })
  });

  if (response.ok) {
    await markDelivery(delivery.delivery_id, true);
    return;
  }
  const message = (await response.text()).slice(0, 900);
  await markDelivery(delivery.delivery_id, false, `Resend ${response.status}: ${message}`, response.status < 500);
}

async function processDeliveries(deliveries: Delivery[]) {
  for (let index = 0; index < deliveries.length; index += 10) {
    const batch = deliveries.slice(index, index + 10);
    await Promise.all(batch.map((delivery) =>
      delivery.channel === "push" ? sendPush(delivery) : sendEmail(delivery)
    ));
  }
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const user = await authenticateUser(request);
    const cronAuthorised = Boolean(CRON_SECRET)
      && request.headers.get("x-dispatch-secret") === CRON_SECRET;

    if (request.method === "GET") {
      if (!user) return json({ error: "Authentication required" }, 401);
      if (!VAPID_PUBLIC_KEY) return json({ error: "Push is not configured" }, 503);
      return json({ vapid_public_key: VAPID_PUBLIC_KEY });
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!user && !cronAuthorised) return json({ error: "Authentication required" }, 401);

    const { error: prepareError } = await admin.rpc("prepare_notification_dispatch");
    if (prepareError) return json({ error: prepareError.message }, 500);

    const { data, error: claimError } = await admin.rpc("claim_notification_deliveries", {
      p_limit: 100
    });
    if (claimError) return json({ error: claimError.message }, 500);

    const deliveries = (Array.isArray(data) ? data : []) as Delivery[];
    await processDeliveries(deliveries);
    return json({ processed: deliveries.length });
  }
};
