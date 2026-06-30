/**
 * Builder: convierte Productos[] interno → Catalog JSON oficial de PedidosYa.
 *
 * Decisiones de diseño:
 * - **IDs determinísticos** desde el SKU interno → re-runs producen mismo catálogo
 *   (idempotente). Permite usar modify-product targeteando el mismo ID.
 * - Toppings (Sin cebolla, Extra cheddar, etc.) se **deduplican globalmente** —
 *   un solo `ed-mod-sin-cebolla` que referencian todos los burgers que lo aceptan.
 * - Tags internos se mapean a `masterCategory` PY (POPULAR, VEGGIE → VEGETARIAN, etc.)
 * - SIN_TACC se modela en `foodLabeling.allergens` como exclusión.
 * - Sin imágenes por ahora — se acepta vacío. Cuando haya URLs, agregar a `Producto.imageUrl`.
 *
 * Doc: docs/pedidosya/MENU_MANAGEMENT.md
 */

import type { Producto, Categoria, ProductoTag, CategoriaId } from "@/lib/data";
import type {
  Catalog, Category as PYCategory, Product as PYProduct, Topping as PYTopping,
  Menu as PYMenu, Reference, OrderedReference, ItemTags, LocaleString,
} from "./types";

// ============================================================
// ID generation determinístico (slug-based, sin UUIDs random)
// ============================================================

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const ID = {
  category: (catId: CategoriaId): string => `ed-cat-${catId}`,
  product: (sku: string): string => `ed-prod-${sku}`,
  variant: (parentSku: string, variantName: string): string =>
    `ed-prod-${parentSku}-${slug(variantName)}`,
  topping: (sku: string, kind: "modifs" | "agregados"): string =>
    `ed-top-${kind}-${sku}`,
  toppingItem: (kind: "mod" | "agr", name: string): string =>
    `ed-${kind}-${slug(name)}`,
  menu: (key: string): string => `ed-menu-${key}`,
  vendor: (posVendorId: string): string => posVendorId,
  schedule: (key: string): string => `ed-sched-${key}`,
};

// ============================================================
// Tag mapping interno → PY taxonomy
// ============================================================

const CATEGORY_TO_MASTER: Record<CategoriaId, string[]> = {
  burgers: ["BURGERS", "MAIN_COURSE"],
  veggies: ["BURGERS", "VEGETARIAN", "MAIN_COURSE"],
  papas: ["SIDE_DISH"],
  entradas: ["APPETIZER", "STARTER"],
  ensaladas: ["SALAD", "MAIN_COURSE"],
  tostados: ["SANDWICH"],
  milas: ["MAIN_COURSE"],
  "sand-mila": ["SANDWICH"],
  sintacc: ["MAIN_COURSE", "GLUTEN_FREE"],
  combos: ["MEAL_DEAL", "COMBO"],
  tiradas: ["BEVERAGE", "ALCOHOL", "BEER"],
  gaseosas: ["BEVERAGE", "SOFT_DRINK"],
  aguas: ["BEVERAGE", "WATER"],
};

const TAG_TO_OCCASION: Partial<Record<ProductoTag, string[]>> = {
  POPULAR: ["GROUP_FRIENDLY", "QUICK_BITE"],
  DESTACADA: ["GROUP_FRIENDLY"],
  "PARA 2": ["GROUP_FRIENDLY", "ROMANTIC"],
  COMBO: ["MEAL_DEAL"],
  PROMO: ["VALUE"],
};

function buildTags(p: Producto): ItemTags {
  const tags: ItemTags = {
    masterCategory: [...(CATEGORY_TO_MASTER[p.cat] ?? [])],
  };
  if (p.tag === "VEGGIE") {
    tags.masterCategory!.push("VEGETARIAN");
  }
  if (p.tag === "SIN TACC") {
    tags.masterCategory!.push("GLUTEN_FREE");
  }
  if (p.cat === "tiradas") {
    tags.ageRestricted = ["ALCOHOL"];
  }
  if (p.tag && TAG_TO_OCCASION[p.tag]) {
    tags.occasionType = TAG_TO_OCCASION[p.tag];
  }
  // Dedup
  if (tags.masterCategory) tags.masterCategory = [...new Set(tags.masterCategory)];
  return tags;
}

function loca(text: string): LocaleString {
  return { default: text };
}

// ============================================================
// Builder principal
// ============================================================

export interface BuildOptions {
  /** Sucursales (posVendorId) a las que aplica este catálogo */
  vendors: string[];
  /** URL del callback para que PY avise el resultado del import */
  callbackUrl: string;
  /** Lista de productos a incluir (filtrable). Si no se pasa, todos. */
  productos?: Producto[];
  /** Lista de categorías. Si no se pasa, todas. */
  categorias?: Categoria[];
  /** Menu único o múltiples. Default: un Menu "main" 24/7 */
  menuTitle?: string;
  /** Schedule del menu. Default: 24/7 sin restricción horaria */
  menuSchedule?: { start: string; end: string; weekdays?: ("MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY")[] };
}

export interface BuildResult {
  catalog: Catalog;
  /** Stats del catálogo construido */
  stats: {
    products: number;
    variants: number;
    toppings: number;
    toppingItems: number;
    categories: number;
  };
  warnings: string[];
}

export function buildCatalog(
  productos: Producto[],
  categorias: Categoria[],
  opts: BuildOptions
): BuildResult {
  const productosToUse = opts.productos ?? productos;
  const categoriasToUse = opts.categorias ?? categorias;
  const warnings: string[] = [];

  const catalog: Catalog = {
    catalogId: `ed-catalog-${Date.now()}`,
    vendors: {},
    menus: {},
    categories: {},
    products: {},
    toppings: {},
    images: {},
    schedules: {},
    callbackUrl: opts.callbackUrl,
  };

  // 1. Vendors
  for (const v of opts.vendors) {
    catalog.vendors[ID.vendor(v)] = { id: ID.vendor(v), type: "Vendor" };
  }

  // 2. Topping items (Sin cebolla, Extra cheddar, etc.) — DEDUP global
  // Lo construimos primero porque los Products los referencian.
  const toppingItemsByName = new Map<string, { id: string; price: string; kind: "mod" | "agr" }>();
  const ensureToppingItem = (name: string, price: number, kind: "mod" | "agr"): string => {
    const cached = toppingItemsByName.get(name);
    if (cached) return cached.id;
    const id = ID.toppingItem(kind, name);
    catalog.products[id] = {
      id,
      type: "Product",
      title: loca(name),
      price: String(price),
      active: true,
    };
    toppingItemsByName.set(name, { id, price: String(price), kind });
    return id;
  };

  // 3. Productos principales + variantes
  let variantsCount = 0;
  for (const p of productosToUse) {
    const productId = ID.product(p.id);

    const product: PYProduct = {
      id: productId,
      type: "Product",
      title: loca(p.nombre),
      ...(p.desc ? { description: loca(p.desc) } : {}),
      price: String(p.precio),
      active: true,
      tags: buildTags(p),
    };

    // SIN_TACC → marcamos foodLabeling
    if (p.tag === "SIN TACC") {
      product.foodLabeling = { allergens: [] }; // explícitamente sin gluten
    }

    // Variantes (sizes) — cada size es un Product hijo
    if (p.sizes && p.sizes.length > 0) {
      const variants: Record<string, OrderedReference> = {};
      p.sizes.forEach(([variantName, priceMod], idx) => {
        const variantId = ID.variant(p.id, variantName);
        catalog.products[variantId] = {
          id: variantId,
          type: "Product",
          title: loca(`${p.nombre} (${variantName})`),
          price: String(p.precio + priceMod),
          active: true,
          parent: { id: productId, type: "Product" },
          tags: buildTags(p),
        };
        variants[variantId] = { id: variantId, type: "Product", order: idx + 1 };
        variantsCount++;
      });
      product.variants = variants;
    }

    // Toppings — modifs (sin/con, sin precio)
    const productToppings: Record<string, OrderedReference> = {};
    let toppingOrder = 1;
    if (p.modifs && p.modifs.length > 0) {
      const toppingId = ID.topping(p.id, "modifs");
      const items: Record<string, OrderedReference> = {};
      p.modifs.forEach((m, idx) => {
        const itemId = ensureToppingItem(m, 0, "mod");
        items[itemId] = { id: itemId, type: "Product", order: idx + 1 };
      });
      catalog.toppings[toppingId] = {
        id: toppingId,
        type: "Topping",
        title: loca("Modificadores"),
        minSelection: 0,
        maxSelection: p.modifs.length,
        products: items,
      };
      productToppings[toppingId] = { id: toppingId, type: "Topping", order: toppingOrder++ };
    }

    // Toppings — agregados (con precio)
    if (p.agregados && p.agregados.length > 0) {
      const toppingId = ID.topping(p.id, "agregados");
      const items: Record<string, OrderedReference> = {};
      p.agregados.forEach(([name, price], idx) => {
        const itemId = ensureToppingItem(name, price, "agr");
        items[itemId] = { id: itemId, type: "Product", order: idx + 1 };
      });
      catalog.toppings[toppingId] = {
        id: toppingId,
        type: "Topping",
        title: loca("Agregados"),
        minSelection: 0,
        maxSelection: 3, // límite razonable
        products: items,
      };
      productToppings[toppingId] = { id: toppingId, type: "Topping", order: toppingOrder++ };
    }

    if (Object.keys(productToppings).length > 0) {
      product.toppings = productToppings;
    }

    catalog.products[productId] = product;
  }

  // 4. Categorías
  for (const c of categoriasToUse) {
    const productosDeCat = productosToUse.filter((p) => p.cat === c.id);
    if (productosDeCat.length === 0) {
      warnings.push(`Categoría "${c.nombre}" sin productos — la incluimos vacía`);
    }
    const products: Record<string, OrderedReference> = {};
    productosDeCat.forEach((p, idx) => {
      const id = ID.product(p.id);
      products[id] = { id, type: "Product", order: idx + 1 };
    });
    const catId = ID.category(c.id);
    catalog.categories[catId] = {
      id: catId,
      type: "Category",
      title: loca(c.nombre),
      active: true,
      products,
    };
  }

  // 5. Menu único con todas las categorías
  const menuId = ID.menu("main");
  const menuCategories: Record<string, OrderedReference> = {};
  categoriasToUse.forEach((c, idx) => {
    const id = ID.category(c.id);
    menuCategories[id] = { id, type: "Category", order: idx + 1 };
  });
  catalog.menus[menuId] = {
    id: menuId,
    type: "Menu",
    title: loca(opts.menuTitle ?? "Menú"),
    active: true,
    categories: menuCategories,
  };

  // 6. Schedule opcional para el menu
  if (opts.menuSchedule) {
    const schedId = ID.schedule("main");
    catalog.schedules[schedId] = {
      id: schedId,
      type: "ScheduleEntry",
      weekdays: opts.menuSchedule.weekdays ?? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      start: opts.menuSchedule.start,
      end: opts.menuSchedule.end,
    };
    catalog.menus[menuId].schedules = {
      [schedId]: { id: schedId, type: "ScheduleEntry", order: 1 },
    };
  }

  return {
    catalog,
    stats: {
      products: productosToUse.length,
      variants: variantsCount,
      toppings: Object.keys(catalog.toppings).length,
      toppingItems: toppingItemsByName.size,
      categories: categoriasToUse.length,
    },
    warnings,
  };
}

/**
 * Helper: filtra productos para PY excluyendo cosas que no aplican delivery
 * (ej "Picada para dos" demasiado grande, complejos de entregar).
 * Customizable.
 */
export function filterDeliveryProductos(productos: Producto[]): Producto[] {
  // Por ahora todos. El user puede customizar esto cuando defina la lista final.
  return productos;
}
