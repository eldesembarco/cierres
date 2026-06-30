/**
 * Types para la integración con Rappi.
 *
 * Doc: https://dev-portal.rappi.com/es/
 *  - Auth: OAuth2 client_credentials, header `x-authorization: Bearer ...`
 *  - Webhooks: HMAC-SHA256 con header `Rappi-Signature: t=...,sign=...`
 *  - 9 eventos webhook documentados
 */

/** Eventos webhook que Rappi nos manda */
export type RappiWebhookEvent =
  | "NEW_ORDER"
  | "ORDER_EVENT_CANCEL"
  | "ORDER_OTHER_EVENT"
  | "MENU_APPROVED"
  | "MENU_REJECTED"
  | "PING"
  | "STORE_CONNECTIVITY"
  | "ORDER_RT_TRACKING"
  | "STORE_PROVISIONING_STATUS";

/** Estados de la State Machine de Rappi (doc oficial) */
export type RappiOrderState =
  | "CREATED"
  | "WEBHOOK"
  | "READY"
  | "SENT"
  | "TAKEN"
  | "REJECTED"
  | "TIMEOUT"
  | "READY_FOR_PICKUP";

/** Métodos de delivery posibles */
export type RappiDeliveryMethod = "delivery" | "marketplace" | "pickup";

/** Cancellation events que vienen en ORDER_EVENT_CANCEL */
export type RappiCancelEvent =
  | "cancel_by_user"
  | "canceled_with_charge"
  | "cancel_without_charges"
  | "cancel_by_support"
  | "cancel_by_support_with_charge"
  | "cancel_by_application_user"
  | "canceled_from_cms"
  | "canceled_by_fraud_automation"
  | "canceled_store_closed"
  | "cancel_by_sk_with_charge";

/** Eventos del lifecycle del pedido (vienen en ORDER_OTHER_EVENT) */
export type RappiOrderLifecycleEvent =
  | "ready_for_pick_up"
  | "domiciliary_in_store"
  | "hand_to_domiciliary"
  | "arrive"
  | "close_order";

/**
 * Shape esperado del payload NEW_ORDER. La doc dice que es la "misma información que
 * el endpoint getOrders" pero no documenta el schema completo. Modelamos los campos
 * que sabemos están y dejamos extra props.
 */
export interface RappiOrderRaw {
  order_id?: string | number;
  store_id?: string | number;
  external_store_id?: string | number;
  state?: RappiOrderState;
  total_value?: number | string;
  delivery_method?: RappiDeliveryMethod;
  user?: {
    name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  address?: {
    street_name?: string;
    street_number?: string;
    district?: string;
    federal_unit?: string;
    description?: string;
    latitude?: number | string;
    longitude?: number | string;
  };
  items?: Array<{
    name?: string;
    quantity?: number;
    price?: number | string;
    sku?: string;
    id?: string | number;
    type?: string;            // PRODUCT | TOPPING | etc.
    comments?: string;
    /** El schema oficial usa `subitems`. Algunos endpoints viejos exponen `toppings`. */
    subitems?: Array<{ name?: string; quantity?: number; price?: number | string; type?: string; sku?: string }>;
    toppings?: Array<{ name?: string; quantity?: number; price?: number | string }>;
  }>;
  payment_method?: string;
  comments?: string;
  cooking_time?: number;
  /** ISO timestamps */
  created_at?: string;
  // Permitimos cualquier campo extra
  [k: string]: unknown;
}

/** Reasons válidos para rechazar (los habituales POS) */
export const RAPPI_REJECT_REASONS = [
  "out_of_stock",
  "store_busy",
  "store_closed",
  "wrong_payment",
  "missing_items",
  "delivery_issues",
  "other",
] as const;
export type RappiRejectReason = typeof RAPPI_REJECT_REASONS[number];
