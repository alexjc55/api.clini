import { createHmac, randomUUID } from "crypto";
import { storage } from "./storage";
import type { Webhook, WebhookEventType } from "@shared/schema";

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
  test?: boolean;
}

export function signWebhookPayload(payload: WebhookPayload, secret: string): string {
  const body = JSON.stringify(payload);
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchWebhook(
  webhook: Webhook,
  event: WebhookEventType,
  data: Record<string, unknown>,
  isTest = false
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payload: WebhookPayload = {
    id: randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data,
    ...(isTest ? { test: true } : {})
  };
  
  const signature = signWebhookPayload(payload, webhook.secret);
  const body = JSON.stringify(payload);
  
  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let error: string | undefined;
  let success = false;
  
  const delivery = await storage.createWebhookDelivery(webhook.id, event, { ...payload } as Record<string, unknown>);
  
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Id": payload.id,
          "X-Webhook-Event": event,
          "User-Agent": "WasteCollectionAPI-Webhooks/1.0"
        },
        body,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      statusCode = response.status;
      responseBody = await response.text().catch(() => "");
      success = response.ok;
      
      await storage.updateWebhookDelivery(delivery.id, statusCode, responseBody || "");
      
      if (success) break;
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error";
      success = false;
      await storage.updateWebhookDelivery(delivery.id, 0, error);
    }
    
    if (!success && attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return { success, statusCode, error };
}

export async function dispatchEventToSubscribers(
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const webhooks = await storage.getWebhooksByEvent(event);
  
  for (const webhook of webhooks) {
    if (webhook.status !== "active") continue;
    
    try {
      await dispatchWebhook(webhook, event, data);
    } catch {
    }
  }
}
