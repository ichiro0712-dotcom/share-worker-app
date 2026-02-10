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
 * IPアドレスのバリデーション
 * 基本的なIPv4/IPv6形式チェック
 */
function isValidIpAddress(ip: string): boolean {
  // IPv4チェック（簡易版）
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6チェック（簡易版）
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv6Regex.test(ip) && ip.includes(':');
}

/**
 * IPアドレスを取得（Vercelのヘッダーから取得）
 * Server Actions/Route Handlersでのみ使用可能
 *
 * 優先順位:
 * 1. x-real-ip（信頼できるプロキシが設定）
 * 2. x-forwarded-for（検証済み）
 */
export async function getClientIpAddress(): Promise<string | null> {
  // 動的インポートでServer Component専用機能を使用
  const { headers } = await import('next/headers');
  const headersList = headers();

  // x-real-ip を優先（より信頼性が高い）
  const realIp = headersList.get('x-real-ip');
  if (realIp && isValidIpAddress(realIp)) {
    return realIp;
  }

  // x-forwarded-for（最初のIPのみ、検証付き）
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (isValidIpAddress(firstIp)) {
      return firstIp;
    }
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

/**
 * デバイス情報とIPアドレスを一度に取得（最適化版）
 * headers() を1回だけ呼び出して両方の情報を取得
 */
export async function getDeviceInfoAndIp(): Promise<{
  deviceInfo: DeviceInfo;
  ipAddress: string | null;
}> {
  // 動的インポートでServer Component専用機能を使用
  const { headers } = await import('next/headers');
  const headersList = headers();

  // User-Agent からデバイス情報を取得
  const userAgent = headersList.get('user-agent') || '';
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const deviceInfo: DeviceInfo = {
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
      type: result.device.type || 'desktop',
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

  // IPアドレスを取得（優先順位: x-real-ip → x-forwarded-for）
  let ipAddress: string | null = null;

  const realIp = headersList.get('x-real-ip');
  if (realIp && isValidIpAddress(realIp)) {
    ipAddress = realIp;
  } else {
    const forwardedFor = headersList.get('x-forwarded-for');
    if (forwardedFor) {
      const firstIp = forwardedFor.split(',')[0].trim();
      if (isValidIpAddress(firstIp)) {
        ipAddress = firstIp;
      }
    }
  }

  return { deviceInfo, ipAddress };
}
