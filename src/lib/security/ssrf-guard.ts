import dns from "node:dns";
import net from "node:net";

import { targetNotAllowed } from "@/lib/errors";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Private / reserved IPv4 ranges
// ---------------------------------------------------------------------------

type Ipv4Range = { base: number; mask: number };

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function cidrToRange(cidr: string): Ipv4Range {
  const [baseIp, bits] = cidr.split("/");
  const base = ipv4ToInt(baseIp);
  const mask = bits === "0" ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return { base, mask };
}

const BLOCKED_IPV4_CIDRS = [
  "127.0.0.0/8",     // Loopback
  "10.0.0.0/8",      // Private class A
  "172.16.0.0/12",   // Private class B
  "192.168.0.0/16",  // Private class C
  "169.254.0.0/16",  // Link-local
  "0.0.0.0/8",       // Current network
];

const BLOCKED_IPV4_RANGES: Ipv4Range[] = BLOCKED_IPV4_CIDRS.map(cidrToRange);

// ---------------------------------------------------------------------------
// Private / reserved IPv6 prefixes
// ---------------------------------------------------------------------------

function normalizeIpv6(ip: string): string {
  // Expand :: and normalize to full 8-group hex
  const parts = ip.split(":");
  const emptyIdx = parts.indexOf("");

  if (emptyIdx !== -1) {
    // Handle :: expansion
    const before = parts.slice(0, emptyIdx).filter(Boolean);
    const after = parts.slice(emptyIdx + 1).filter(Boolean);
    const missing = 8 - before.length - after.length;
    const expanded = [...before, ...Array(missing).fill("0"), ...after];
    return expanded.map((p) => p.padStart(4, "0")).join(":");
  }

  return parts.map((p) => p.padStart(4, "0")).join(":");
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = normalizeIpv6(ip).toLowerCase();

  // ::1 — loopback
  if (normalized === "0000:0000:0000:0000:0000:0000:0000:0001") return true;

  const firstGroup = normalized.slice(0, 4);
  const firstByte = parseInt(firstGroup.slice(0, 2), 16);

  // fc00::/7 — unique local (fc or fd)
  if ((firstByte & 0xfe) === 0xfc) return true;

  // fe80::/10 — link-local
  if (firstByte === 0xfe && (parseInt(firstGroup.slice(2, 4), 16) & 0xc0) === 0x80) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

function isBlockedIpv4(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(
    (range) => (addr & range.mask) === (range.base & range.mask),
  );
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return false;
}

function isAllowPrivateNetworks(): boolean {
  return process.env.ALLOW_PRIVATE_NETWORKS === "true";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate that a target host is not a private/reserved/loopback address.
 * For domain names, resolves DNS first then checks all returned IPs.
 *
 * Throws `targetNotAllowed` if the host resolves to a blocked address.
 * Skipped when `ALLOW_PRIVATE_NETWORKS=true` (development only).
 */
export async function assertHostAllowed(host: string): Promise<void> {
  if (isAllowPrivateNetworks()) {
    logger.debug({ host }, "SSRF check skipped (ALLOW_PRIVATE_NETWORKS=true)");
    return;
  }

  // Direct IP address
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      logger.warn({ host }, "SSRF: blocked direct IP");
      throw targetNotAllowed(host);
    }
    return;
  }

  // Domain name — resolve and check all IPs
  let addresses: string[];
  try {
    const resolver = new dns.promises.Resolver();
    // Try IPv4 first, then IPv6
    const [ipv4, ipv6] = await Promise.allSettled([
      resolver.resolve4(host),
      resolver.resolve6(host),
    ]);

    addresses = [
      ...(ipv4.status === "fulfilled" ? ipv4.value : []),
      ...(ipv6.status === "fulfilled" ? ipv6.value : []),
    ];
  } catch {
    // DNS resolution failure — allow through (connection will fail naturally)
    logger.debug({ host }, "SSRF: DNS resolution failed, allowing through");
    return;
  }

  if (addresses.length === 0) {
    return;
  }

  for (const ip of addresses) {
    if (isBlockedIp(ip)) {
      logger.warn({ host, resolvedIp: ip }, "SSRF: blocked resolved IP");
      throw targetNotAllowed(host);
    }
  }
}
