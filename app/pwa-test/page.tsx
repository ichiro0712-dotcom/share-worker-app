'use client';

import { NotificationButton } from '@/components/pwa/NotificationButton';
import { IOSInstallGuide } from '@/components/pwa/IOSInstallGuide';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function PwaTestPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(false);

    const sendTestNotification = async (type: 'worker' | 'facility_admin') => {
        if (!session?.user?.id) {
            alert('Please login first');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/push/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: parseInt(session.user.id, 10),
                    userType: type,
                    title: 'Test Notification',
                    message: `This is a test message for ${type}`,
                    url: '/pwa-test',
                }),
            });
            const data = await res.json();
            if (data.success) {
                alert(`Notification sent to ${type}! (Results: ${JSON.stringify(data.results)})`);
            } else {
                alert('Failed: ' + JSON.stringify(data));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
        setLoading(false);
    };

    return (
        <div className="p-8 space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">PWA & Push Notification Test</h1>

            <div className="bg-gray-100 p-4 rounded">
                <strong>Current User:</strong> {session?.user?.email || 'Not logged in'} (ID: {session?.user?.id})
            </div>

            <section className="space-y-4 border p-4 rounded">
                <h2 className="text-xl font-bold">1. Install Guide (iOS)</h2>
                <p className="text-gray-600">This component only appears on iOS browsers (not standalone).</p>
                <IOSInstallGuide />
                <div className="text-xs text-gray-400">Component is mounted.</div>
            </section>

            <section className="space-y-4 border p-4 rounded">
                <h2 className="text-xl font-bold">2. Notification Permission & Subscription</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white border rounded shadow-sm">
                        <h3 className="font-bold mb-2 text-indigo-600">Worker</h3>
                        <div className="mb-4">
                            <NotificationButton userType="worker" />
                        </div>
                        <button
                            onClick={() => sendTestNotification('worker')}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
                        >
                            Send Test Notification
                        </button>
                    </div>

                    <div className="p-4 bg-white border rounded shadow-sm">
                        <h3 className="font-bold mb-2 text-emerald-600">Facility Admin</h3>
                        <div className="mb-4">
                            <NotificationButton userType="facility_admin" />
                        </div>
                        <button
                            onClick={() => sendTestNotification('facility_admin')}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 text-sm"
                        >
                            Send Test Notification
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
