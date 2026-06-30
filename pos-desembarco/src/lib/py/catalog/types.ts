/**
 * Subset del schema oficial de PedidosYa Catalog API.
 * Spec completa: docs/pedidosya/catalog-schema.yaml (1176 líneas).
 *
 * Modelamos solo lo que vamos a generar/leer. Los campos opcionales que no usamos
 * los dejamos sin tipo estricto para no agregar fricción.
 */

/** Diccionario locale → texto. "default" es el fallback. */
export type LocaleString = {
  default: string;
  [locale: string]: string;
};

export type EntityType =
  | "Catalog" | "Menu" | "Category" | "Product" | "Topping"
  | "Image" | "ScheduleEntry" | "Vendor";

/** Referencia a otra entidad — todo se conecta por ID en el root */
export interface OrderedReference {
  id: string;
  type: EntityType;
  order?: number;
}

/** Enlaces simples (sin order) */
export interface Reference {
  id: string;
  type: EntityType;
}

// ============================================================
// Producto / Topping
// ============================================================

export interface FoodLabelingProperties {
  allergens?: string[];                  // GLUTEN, DAIRY, NUTS, EGG, FISH, SOY, ...
  nutritionalInfo?: {
    calories?: number;
    fat?: number;
    saturatedFat?: number;
    carbs?: number;
    sugar?: number;
    protein?: number;
    salt?: number;
  };
}

export interface ItemTags {
  masterCategory?: string[];   // taxonomía PY: BURGERS, MAIN_COURSE, BEVERAGE, ...
  occasionType?: string[];     // GROUP_FRIENDLY, QUICK_BITE, ROMANTIC, ...
  ageRestricted?: string[];    // ALCOHOL, ENERGY_DRINK, TOBACCO
}

export interface Product {
  id: string;
  type: "Product";
  title: LocaleString;
  description?: LocaleString;
  /** Precio en string. PY usa string para evitar floats. */
  price?: string;
  containerPrice?: string;
  active: boolean;
  isPrepackedItem?: boolean;
  isExpressItem?: boolean;
  excludeDishInformation?: boolean;
  calories?: number;
  /** Si es variante: referencia al producto padre */
  parent?: Reference;
  /** Variantes: ID → producto hijo (tamaños, sabores) */
  variants?: Record<string, OrderedReference>;
  /** Toppings: ID → grupo de agregados */
  toppings?: Record<string, OrderedReference>;
  images?: Record<string, OrderedReference>;
  tags?: ItemTags;
  foodLabeling?: FoodLabelingProperties;
}

export interface Topping {
  id: string;
  type: "Topping";
  title: LocaleString;
  description?: LocaleString;
  minSelection: number;
  maxSelection: number;
  /** Cada topping individual es un Product que se referencia */
  products: Record<string, OrderedReference>;
}

// ============================================================
// Category / Menu / Schedule
// ============================================================

export interface Category {
  id: string;
  type: "Category";
  title: LocaleString;
  description?: LocaleString;
  active: boolean;
  products: Record<string, OrderedReference>;
  /** Schedule (horarios) opcional */
  schedules?: Record<string, OrderedReference>;
}

export interface Menu {
  id: string;
  type: "Menu";
  title: LocaleString;
  active: boolean;
  categories: Record<string, OrderedReference>;
  schedules?: Record<string, OrderedReference>;
}

export type Weekday =
  | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY"
  | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface ScheduleEntry {
  id: string;
  type: "ScheduleEntry";
  weekdays: Weekday[];
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
}

// ============================================================
// Image
// ============================================================

export interface Image {
  id: string;
  type: "Image";
  /** URL pública absoluta. Mínimo 640×270. Vacío válido si no hay foto. */
  url: string;
}

// ============================================================
// Catalog (root)
// ============================================================

export interface Catalog {
  catalogId: string;
  /** Sucursales a las que aplica este catálogo */
  vendors: Record<string, Reference>;
  menus: Record<string, Menu>;
  categories: Record<string, Category>;
  products: Record<string, Product>;
  toppings: Record<string, Topping>;
  images: Record<string, Image>;
  schedules: Record<string, ScheduleEntry>;
  /** PY te avisa el resultado del import en esta URL (POST async) */
  callbackUrl: string;
}

// ============================================================
// Availability update
// ============================================================

export interface AvailabilityUpdateRequest {
  items: Array<{
    /** Nuestro código interno (mapea a remoteCode) */
    remoteCode: string;
    available: boolean;
    reason?: "OUT_OF_STOCK" | "TEMPORARILY_UNAVAILABLE" | "OTHER";
  }>;
}

// ============================================================
// Modify Product
// ============================================================

export interface ModifyProductRequest {
  processId: string;
  batchId: string;
  /** ISO timestamp del request actual */
  timestamp: string;
  /** ISO timestamp del último cambio (para idempotency) */
  timestampLastChange: string;
  callback?: string;
  product: {
    productId: string;
    parentId?: string | null;
    action: "upsert" | "delete";
    /** Lista de campos que cambiaron — PY solo aplica los que están acá */
    updatedFields: Array<"name" | "description" | "price" | "active" | "tags" | "containerPrice">;
    names?: Array<{ locale: string; value: string; action: "upsert" | "delete"; updatedFields?: string[] }>;
    descriptions?: Array<{ locale: string; value: string; action: "upsert" | "delete"; updatedFields?: string[] }>;
    price?: string;
    containerPrice?: string;
    active?: boolean;
    tags?: ItemTags;
  };
}
