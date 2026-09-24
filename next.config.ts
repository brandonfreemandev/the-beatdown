import type { NextConfig } from 'next';
import os from 'os';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// The OpenNext dev initializer exposes Cloudflare bindings to `next dev`, but no app
// code consumes them (`getCloudflareContext` is unused) and it balloons memory until
// Node OOMs (~2 GB within 30s of boot). Opt in explicitly if bindings are ever needed:
//   NEXT_DEV_CLOUDFLARE_BINDINGS=1 npm run dev
if (process.env.NEXT_DEV_CLOUDFLARE_BINDINGS === '1') {
  initOpenNextCloudflareForDev();
}

/** LAN IPs so phones on the same WiFi can load `/_next/*` chunks in dev (Next 16 blocks cross-origin by default). */
function getLanIps(): string[] {
  const fromEnv = process.env.ALLOWED_DEV_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const ips = new Set<string>(fromEnv);
  try {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const addr of addrs ?? []) {
        if (addr.family === 'IPv4' && !addr.internal) ips.add(addr.address);
      }
    }
  } catch {
    // Sandbox / restricted environments — rely on ALLOWED_DEV_ORIGINS env var.
  }
  return [...ips];
}

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: getLanIps(),
};

export default nextConfig;
