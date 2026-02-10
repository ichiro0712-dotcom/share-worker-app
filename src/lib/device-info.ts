import { UAParser } from 'ua-parser-js';

/**
 * デバイス情報（OS、ブラウザ、端末）を取得する
 */
export interface DeviceInfo {
  browser: {
    name?: string;
    version?: string;
    major?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
  device: {
    type?: string; // 'mobile' | 'tablet' | 'desktop' | undefined
    vendor?: string;
    model?: string;
  };
  engine: {
    name?: string;
    version?: string;
  };
  cpu: {
    architecture?: string;
  };
  userAgent: string;
}

/**
 * リクエストヘッダーからUser-Agentを取得してデバイス情報を解析
 * Server Actions/Route Handlersでのみ使用可能
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  // 動的インポートでServer Component専用機能を使用
  const { headers } = await import('next/headers');
  const headersList = headers();
  const userAgent = headersList.get('user-agent') || '';

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: {
      name: result.browser.name,
      version: result.browser.version,
      major: result.browser.major,
    },
    os: {
      name: result.os.name,
      version: result.os.version,
    },
    device: {
      type: result.device.type || 'desktop', // typeが空の場合はdesktop扱い
      vendor: result.device.vendor,
      model: result.device.model,
    },
    engine: {
      name: result.engine.name,
      version: result.engine.version,
    },
    cpu: {
      architecture: result.cpu.architecture,
    },
    userAgent,
  };
}

/**
 * IPアドレスを取得（Vercelのヘッダーから取得）
 * Server Actions/Route Handlersでのみ使用可能
 */
export async function getClientIpAddress(): Promise<string | null> {
  // 動的インポートでServer Component専用機能を使用
  const { headers } = await import('next/headers');
  const headersList = headers();

  // Vercelの場合は x-forwarded-for を使用
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // x-real-ip も確認
  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return null;
}

/**
 * デバイス情報を人間が読みやすい文字列に変換
 * @example "Chrome 120.0 on Windows 10 (Desktop)"
 */
export function formatDeviceInfo(info: DeviceInfo): string {
  const browser = info.browser.name
    ? `${info.browser.name} ${info.browser.version || ''}`.trim()
    : 'Unknown Browser';

  const os = info.os.name
    ? `${info.os.name} ${info.os.version || ''}`.trim()
    : 'Unknown OS';

  const device = info.device.type
    ? info.device.type.charAt(0).toUpperCase() + info.device.type.slice(1)
    : 'Desktop';

  return `${browser} on ${os} (${device})`;
}

/**
 * デバイス情報を簡略化したオブジェクトに変換（ログ保存用）
 */
export function simplifyDeviceInfo(info: DeviceInfo) {
  return {
    browser: `${info.browser.name || 'Unknown'} ${info.browser.version || ''}`.trim(),
    os: `${info.os.name || 'Unknown'} ${info.os.version || ''}`.trim(),
    device: info.device.type || 'desktop',
    model: info.device.model || null,
  };
}
