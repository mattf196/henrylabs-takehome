import { PaymentProcessor } from "@henrylabs-interview/payments";

const WEBHOOK_SECRET = "whsec_henry_takehome";
const processor = new PaymentProcessor({
  apiKey: "824c951e-dfac-4342-8e03",
});

await processor.webhooks.createEndpoint({
  url: "http://localhost:3000/webhooks",
  events: [
    "checkout.create.success",
    "checkout.create.failure",
    "checkout.confirm.success",
    "checkout.confirm.failure",
  ],
  secret: WEBHOOK_SECRET,
});

// --- Pending webhook resolution ---

const pendingCheckouts = new Map<
  string,
  {
    resolve: (value: any) => void;
    timer: ReturnType<typeof setTimeout>;
    type: "create" | "confirm";
  }
>();

function waitForWebhook(
  _reqId: string,
  type: "create" | "confirm",
  timeoutMs = 10000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCheckouts.delete(_reqId);
      reject(new Error("Webhook timeout"));
    }, timeoutMs);
    pendingCheckouts.set(_reqId, { resolve, timer, type });
  });
}

// --- Retry logic for 503-retry responses ---

async function retryWithBackoff<T extends { substatus?: string }>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    const result = await fn();
    attempt++;
    if (result.substatus !== "503-retry" || attempt >= maxRetries) {
      return result;
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
  }
}

// --- Currency conversion ---

const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  JPY: 0.0067,
};

function toUSD(amount: number, currency: string): number {
  const rate = USD_RATES[currency];
  if (!rate) return amount;
  return Math.round(amount * rate * 100) / 100;
}

// --- HTTP helpers ---

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// --- Server ---

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- Products ---
    if (url.pathname === "/products" && req.method === "GET") {
      const file = Bun.file("./content/products.json");
      const products = await file.json();
      return json(products);
    }

    // --- Create Checkout ---
    if (url.pathname === "/checkout" && req.method === "POST") {
      const body = await req.json();
      const amountUSD = toUSD(body.amount, body.currency);

      const result = await retryWithBackoff(async () => {
        const response = await processor.checkout.create({
          amount: amountUSD,
          currency: "USD",
          customerId: body.customerId,
        });

        if (response.substatus === "202-deferred") {
          try {
            return await waitForWebhook(response._reqId, "create");
          } catch {
            return {
              substatus: "503-retry",
              status: "failure",
              code: 503,
              message: "Timeout waiting for payment processor",
            } as any;
          }
        }

        return response;
      });

      return json(result, result.code);
    }

    // --- Confirm Checkout ---
    if (url.pathname === "/checkout/confirm" && req.method === "POST") {
      const body = await req.json();

      const result = await retryWithBackoff(async () => {
        const response = await processor.checkout.confirm(body);

        if (response.substatus === "202-deferred") {
          try {
            return await waitForWebhook(response._reqId, "confirm");
          } catch {
            return {
              substatus: "503-retry",
              status: "failure",
              code: 503,
              message: "Timeout waiting for payment processor",
            } as any;
          }
        }

        return response;
      });

      return json(result, result.code);
    }

    // --- Webhook Receiver ---
    if (url.pathname === "/webhooks" && req.method === "POST") {
      const body = await req.text();
      const event = JSON.parse(body);
      console.log(
        `[webhook] ${event.type}`,
        event.data?.status,
        event.data?.substatus
      );

      const reqId = event.data?._reqId;

      // Primary match: by _reqId
      if (reqId && pendingCheckouts.has(reqId)) {
        const pending = pendingCheckouts.get(reqId)!;
        clearTimeout(pending.timer);
        pending.resolve(event.data);
        pendingCheckouts.delete(reqId);
      } else if (event.type?.startsWith("checkout.confirm.")) {
        // Fallback: SDK generates a new _reqId for deferred confirm success
        // webhooks, so the original _reqId won't match. Find any pending
        // confirm entry and resolve it.
        for (const [key, pending] of pendingCheckouts) {
          if (pending.type === "confirm") {
            clearTimeout(pending.timer);
            pending.resolve(event.data);
            pendingCheckouts.delete(key);
            break;
          }
        }
      }

      return new Response("ok", { headers: corsHeaders });
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log("Server running on http://localhost:3000");
