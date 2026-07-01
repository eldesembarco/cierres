import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ssh2 (que usa ssh2-sftp-client, para leer el SFTP de Mercado Pago en
  // /api/mp/resumen) tiene dependencias nativas que Turbopack no puede empaquetar
  // ("asset is not placeable in ESM chunks"). Lo externalizamos para que corra con
  // el require nativo de Node en el route handler (runtime nodejs).
  serverExternalPackages: ["ssh2", "ssh2-sftp-client"],
};

export default nextConfig;
