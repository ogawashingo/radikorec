import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pino は内部で worker_threads を使用し、動的にモジュールを読み込むため、
  // Next.js のバンドラーでは正しく処理できない。
  // serverExternalPackages に追加することで、バンドル対象から除外し、
  // Node.js のネイティブ require で解決させる。
  serverExternalPackages: ["pino", "pino-pretty", "pino-abstract-transport"],
};

export default nextConfig;
