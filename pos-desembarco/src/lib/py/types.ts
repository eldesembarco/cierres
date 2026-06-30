/**
 * Types para integración Delivery Hero / PedidosYa.
 * No replico el schema completo (~3000 líneas YAML); solo los campos que tocamos.
 * El resto del payload lo guardamos como `raw` para auditoría.
 */

export type PYExpedition = "delivery" | "pickup";
export type PYOrderStateLocal =
  | "received"     // recibido del webhook, todavía no acceptado
  | "accepted"     // aceptado, va a cocina
  | "rejected"     // rechazado por nosotros
  | "preparing"    // en cocina (sinónimo de aceptado pero más explícito)
  | "ready"        // listo para retirar
  | "picked_up"    // entregado al cadete
  | "cancelled"    // cancelado por PY (auto o por cliente)
  | "completed";   // ciclo completo

export interface PYItem {
  name: string;
  quantity: string | number;
  paidPrice?: string;
  unitPrice?: string;
  remoteCode?: string;
  sku?: string;
  categoryName?: string;
  selectedToppings?: Array<{ name: string; quantity?: string | number; price?: string }>;
  comment?: string;
}

export interface PYAddress {
  street?: string;
  number?: string;
  city?: string;
  postalCode?: string;
  details?: string;
  latitude?: number;
  longitude?: number;
}

export interface PYCustomer {
  firstName?: string;
  lastName?: string;
  mobilePhone?: string;
  email?: string;
}

export interface PYOrderRaw {
  // campos que sabemos con seguridad están en el payload
  token: string;                    // único en DH, lo usamos como llave en POST /v2/order/status/{token}
  code?: string;                    // human-readable order code
  expeditionType?: PYExpedition;
  expeditionTime?: string;          // ISO
  customer?: PYCustomer;
  delivery?: { address?: PYAddress | null; riderPickupTime?: string | null };
  pickup?: unknown;
  products?: PYItem[];
  payment?: { type?: string; status?: string; vatId?: string };
  price?: {
    totalNet?: string;
    totalGross?: string;
    deliveryFees?: string;
    serviceCharge?: string;
    subTotal?: string;
    /** Cuánto debe cobrar el rider en mano al cliente (orders en efectivo) */
    collectFromCustomer?: string;
    /** Cuánto le da el rider al restaurant cuando retira (Own Delivery Orders) */
    payRestaurant?: string;
    /** Propina al rider */
    riderTip?: string;
    /** IVA total */
    vatTotal?: string;
  };
  comments?: { customerComment?: string; vendorComment?: string; cutleryNotes?: string };
  callbackUrls?: {
    orderAcceptedUrl?: string;
    orderRejectedUrl?: string;
    orderPickedUpUrl?: string;
    preparationCompletedUrl?: string;
    adjustPreparationTimeUrl?: string;
    productModificationUrl?: string;
  };
  // permitimos cualquier campo adicional — la spec advierte explícitamente
  // "POS plugin must be capable to ignore additional properties"
  [k: string]: unknown;
}

/** Discriminator entre apps de delivery */
export type DeliveryApp = "pedidosya" | "rappi";

/** Estado local unificado — sirve para PY y Rappi (mapeado desde el state de cada uno) */
export type LocalState = PYOrderStateLocal;

/** Base común a todos los pedidos guardados */
export interface StoredOrderBase {
  /** Nuestro id interno. Formato: ED-XXXXXX */
  id: string;
  /** App de delivery */
  app: DeliveryApp;
  /** ID corto para mostrar (código PY o ID corto Rappi) */
  pyCode: string;
  /** RemoteId del restaurante (de la URL del webhook PY o storeId de Rappi) */
  remoteId: string;
  state: LocalState;
  receivedAt: number;
  updatedAt: number;
  /** Cuándo cambió a state=accepted. Usado para gating del botón "Marcar listo". */
  acceptedAt?: number;
  rejectionReason?: string;
  prepTimeMin?: number;
}

/** Pedido PY: incluye token único de PY usado en todas las llamadas al middleware */
export interface StoredOrderPY extends StoredOrderBase {
  app: "pedidosya";
  pyToken: string;
  raw: PYOrderRaw;
}

/** Pedido Rappi: el ID viene de la propia plataforma, no se genera */
export interface StoredOrderRappi extends StoredOrderBase {
  app: "rappi";
  /** Order ID que asigna Rappi — usado en /take, /reject, /ready-for-pickup */
  rappiOrderId: string;
  /** Store ID de la sucursal en Rappi */
  rappiStoreId: string;
  /** Domain del país (ej services.rappi.com.ar) — necesario para los calls outbound */
  countryDomain: string;
  /** Raw payload del NEW_ORDER */
  raw: unknown;
}

export type StoredOrder = StoredOrderPY | StoredOrderRappi;

export type CallbackKind = "accept" | "reject" | "ready" | "picked_up";
