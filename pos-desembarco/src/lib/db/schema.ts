import { sql } from "@vercel/postgres";

/**
 * DDL del store de pedidos. Idempotente — corre en cada deploy via /api/admin/init-db
 * o en el primer fetch.
 *
 * Diseño desnormalizado: campos clave (state, app, totales, customer) se sacan del JSON
 * y van a columnas para que las queries de reportes corran con índices.
 * El payload completo queda en `raw` JSONB para auditoría.
 */
export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id              TEXT PRIMARY KEY,
      app             TEXT NOT NULL,
      state           TEXT NOT NULL,
      received_at     BIGINT NOT NULL,
      updated_at      BIGINT NOT NULL,
      remote_id       TEXT,
      py_code         TEXT,

      -- discriminador-específicos
      py_token        TEXT,
      rappi_order_id  TEXT,
      rappi_store_id  TEXT,
      country_domain  TEXT,

      -- denormalizados para reports rápidos
      customer_name   TEXT,
      customer_phone  TEXT,
      total_value     INTEGER NOT NULL DEFAULT 0,
      items_count     INTEGER NOT NULL DEFAULT 0,
      payment_method  TEXT,

      rejection_reason TEXT,
      prep_time_min    INTEGER,

      raw             JSONB NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_orders_received_at ON orders (received_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_app_state ON orders (app, state)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_py_token ON orders (py_token) WHERE py_token IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_rappi ON orders (rappi_order_id) WHERE rappi_order_id IS NOT NULL`;

  // tabla de items denormalizada (para top-products)
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      idx             INTEGER NOT NULL,
      name            TEXT NOT NULL,
      quantity        INTEGER NOT NULL DEFAULT 1,
      unit_price      INTEGER NOT NULL DEFAULT 0,
      total_price     INTEGER NOT NULL DEFAULT 0,
      sku             TEXT,
      PRIMARY KEY (order_id, idx)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_name ON order_items (name)`;
}

/** Para QA: limpia ambas tablas. NO usar en prod sin confirmación. */
export async function nukeAllOrders(): Promise<void> {
  await sql`DELETE FROM order_items`;
  await sql`DELETE FROM orders`;
}
