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

function isLeaf(index: number, filter: Uint32Array): boolean {
    return filter[index * 2] === 0 && filter[index * 2 + 1] === 0;
}

interface IpCheckOptions {
    includeCidr?: boolean;
}

interface IpCheckResult {
    matches: boolean;
    cidr: string;
}

function buildCidr(path: number[], isIpv6: boolean): string {
    // Convert path of bits to IP and prefix length
    const bytes = new Uint8Array(isIpv6 ? 16 : 4);
    const prefixLength = path.length;

    // Fill in the known bits from the path
    for (let i = 0; i < path.length; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitPosition = 7 - (i % 8);
        bytes[byteIndex] |= (path[i] << bitPosition);
    }

    // Convert bytes to IP string
    const parts = isIpv6 ?
        // IPv6: Convert each pair of bytes to hex
        Array.from({ length: 8 }, (_, i) =>
            ((bytes[i * 2] << 8) | bytes[i * 2 + 1]).toString(16)
        ).join(':') :
        // IPv4: Convert each byte to decimal
        Array.from(bytes).join('.');

    return `${parts}/${prefixLength}`;
}

export function ipCheck(ip: string, options?: { includeCidr: true }): IpCheckResult;
export function ipCheck(ip: string, options?: { includeCidr: false }): boolean;
export function ipCheck(ip: string, options: IpCheckOptions = { includeCidr: false }): boolean | IpCheckResult {
    const bytes = ipToBytes(ip);
    const IP_FILTER = bytes.length === 4 ? IP_FILTER_V4 : IP_FILTER_V6;
    const path: number[] | undefined = options.includeCidr ? [] : undefined;

    let nodeIndex = 0;
    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
        const byte = bytes[byteIndex];
        for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
            const bit = (byte >> bitIndex) & 1;
            if (isLeaf(nodeIndex, IP_FILTER)) {
                return options.includeCidr ? {
                    matches: true,
                    cidr: buildCidr(path as number[], bytes.length === 16)
                } : true;
            }

            path?.push(bit);
            const nextIndex = IP_FILTER[nodeIndex * 2 + bit];
            if (nextIndex === 0) {
                return options.includeCidr ? {
                    matches: false,
                    cidr: null
                } : false;
            }
            nodeIndex = nextIndex;
        }
    }

    const matches = isLeaf(nodeIndex, IP_FILTER);
    return options.includeCidr ? {
        matches,
        cidr: matches ? buildCidr(path as number[], bytes.length === 16) : null
    } : matches;
}

const IP_FILTER_V4: Uint32Array = new Uint32Array({{ filterV4 }});
const IP_FILTER_V6: Uint32Array = new Uint32Array({{ filterV6 }});
