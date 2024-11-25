/**
 * Converts an IPv4 address string to a byte array
 * @param ip IPv4 address string (e.g., "192.168.1.1")
 * @returns Uint8Array of 4 bytes
 * @throws Error if invalid IPv4 format
 */
function ipv4ToBytes(ip: string): Uint8Array {
    const parts = ip.split('.');
    if (parts.length !== 4) {
        throw new Error('Invalid IPv4 address format');
    }

    const bytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
        const num = parseInt(parts[i], 10);
        if (isNaN(num) || num < 0 || num > 255) {
            throw new Error(`Invalid IPv4 octet: ${parts[i]}`);
        }
        bytes[i] = num;
    }
    return bytes;
}

/**
 * Converts an IPv6 address string to a byte array
 * @param ip IPv6 address string (e.g., "2001:0db8:85a3:0000:0000:8a2e:0370:7334")
 * @returns Uint8Array of 16 bytes
 * @throws Error if invalid IPv6 format
 */
function ipv6ToBytes(ip: string): Uint8Array {
    // Remove IPv6 zone index if present
    const zoneIndex = ip.indexOf('%');
    if (zoneIndex !== -1) {
        ip = ip.substring(0, zoneIndex);
    }

    // Expand :: notation
    const doubleColonIndex = ip.indexOf('::');
    if (doubleColonIndex !== -1) {
        const before = ip.substring(0, doubleColonIndex).split(':');
        const after = ip.substring(doubleColonIndex + 2).split(':');
        const missing = 8 - (before.length + after.length);
        const middle = Array(missing).fill('0');
        ip = [...before, ...middle, ...after].join(':');
    }

    const parts = ip.split(':');
    if (parts.length !== 8) {
        throw new Error('Invalid IPv6 address format');
    }

    const bytes = new Uint8Array(16);
    for (let i = 0; i < 8; i++) {
        const num = parseInt(parts[i], 16);
        if (isNaN(num) || num < 0 || num > 65535) {
            throw new Error(`Invalid IPv6 hextet: ${parts[i]}`);
        }
        bytes[i * 2] = (num >> 8) & 0xff;
        bytes[i * 2 + 1] = num & 0xff;
    }
    return bytes;
}

/**
 * Converts an IP address string to a byte array, automatically detecting IPv4 or IPv6
 * @param ip IP address string
 * @returns Uint8Array of either 4 bytes (IPv4) or 16 bytes (IPv6)
 * @throws Error if invalid IP format
 */
function ipToBytes(ip: string): Uint8Array {
    return ip.includes(':') ? ipv6ToBytes(ip) : ipv4ToBytes(ip);
}

function isLeaf(node: [bigint, bigint]): boolean {
    return node[0] === 0n && node[1] === 0n;
}

export function ipCheck(ip: string): boolean {
    const bytes = ipToBytes(ip);
    const IP_FILTER = bytes.length === 4 ? IP_FILTER_V4 : IP_FILTER_V6;

    let root = IP_FILTER[0];
    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
        const byte = bytes[byteIndex];
        // Loop through each bit from MSB (7) to LSB (0)
        for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
            const bit = Number((byte >> bitIndex) & 1);
            if (isLeaf(root)) {
                return true;
            }

            if (root[bit] === 0n) {
                return false
            } else {
                root = IP_FILTER[Number(root[bit])];
            }
        }
    }

    return isLeaf(root);
}

const IP_FILTER_V4: [bigint, bigint][] = {{ filterV4 }};
const IP_FILTER_V6: [bigint, bigint][] = {{ filterV6 }};
