'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function DevQRPage() {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [localIP, setLocalIP] = useState<string>('192.168.11.7');
    const [port] = useState('3000');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // ローカルIPを取得（手動設定）
        // 実際のIPは ifconfig | grep "inet " で確認
        const url = `http://${localIP}:${port}`;

        QRCode.toDataURL(url, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
        }).then(setQrDataUrl);
    }, [localIP, port]);

    const url = `http://${localIP}:${port}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    スマホテスト用 QRコード
                </h1>
                <p className="text-gray-500 text-sm mb-6">
                    同じWi-Fiに接続したスマホでスキャンしてください
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        IPアドレス設定
                    </label>
                    <input
                        type="text"
                        value={localIP}
                        onChange={(e) => setLocalIP(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例: 192.168.1.10"
                    />
                </div>

                {qrDataUrl && (
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200 inline-block mb-6">
                        <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
                    </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <p className="text-sm text-gray-500 mb-1">アクセスURL</p>
                    <p className="text-lg font-mono font-bold text-blue-600 break-all">
                        {url}
                    </p>
                </div>

                <button
                    onClick={copyToClipboard}
                    className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
                >
                    {copied ? '✓ コピーしました' : 'URLをコピー'}
                </button>

                <div className="mt-8 text-left bg-yellow-50 rounded-xl p-4">
                    <h3 className="font-bold text-yellow-800 mb-2">接続できない場合</h3>
                    <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                        <li>スマホとPCが同じWi-Fiに接続されているか確認</li>
                        <li>開発サーバーが起動しているか確認</li>
                        <li>ファイアウォール設定を確認</li>
                    </ol>
                </div>

                <div className="mt-4 text-left bg-gray-50 rounded-xl p-4">
                    <h3 className="font-bold text-gray-700 mb-2">IPアドレスの更新方法</h3>
                    <p className="text-sm text-gray-600 mb-2">
                        IPが変わった場合は、ターミナルで以下を実行：
                    </p>
                    <code className="text-xs bg-gray-200 px-2 py-1 rounded block overflow-x-auto">
                        ifconfig | grep &quot;inet &quot; | grep -v 127.0.0.1
                    </code>
                </div>
            </div>
        </div>
    );
}
