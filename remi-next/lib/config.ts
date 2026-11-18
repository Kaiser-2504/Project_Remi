export const MINIMUM_NODE_VERSION = '22.13.0';

// Giả định, chờ nhóm chốt.
export const FUNCTION_REGION = 'auto';

// Giả định, chờ nhóm chốt; hiện theo maxDuration của route AI.
export const FUNCTION_MAX_DURATION = 30;

export interface AppConfig {
  ok: boolean;
  errors: string[];
  runtime: 'nodejs';
  region: string;
  maxDuration: number;
}

function parseNodeVersion(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isBelowMinimum(version: [number, number, number]): boolean {
  const [major, minor, patch] = version;
  const [minimumMajor, minimumMinor, minimumPatch] = MINIMUM_NODE_VERSION.split('.').map(Number);
  return major < minimumMajor ||
    (major === minimumMajor && minor < minimumMinor) ||
    (major === minimumMajor && minor === minimumMinor && patch < minimumPatch);
}

export function validateConfig(
  env: Record<string, string | undefined>,
  nodeVersion: string,
): AppConfig {
  const errors: string[] = [];
  const parsedVersion = parseNodeVersion(nodeVersion);

  if (!parsedVersion) {
    errors.push('Không đọc được phiên bản Node.js.');
  } else if (isBelowMinimum(parsedVersion)) {
    errors.push(`Cần Node.js ${MINIMUM_NODE_VERSION} trở lên.`);
  }

  if (!env.DATABASE_URL?.trim()) {
    errors.push('Thiếu DATABASE_URL (kết nối Postgres dùng cho ứng dụng).');
  }

  return {
    ok: errors.length === 0,
    errors,
    runtime: 'nodejs',
    region: FUNCTION_REGION,
    maxDuration: FUNCTION_MAX_DURATION,
  };
}
