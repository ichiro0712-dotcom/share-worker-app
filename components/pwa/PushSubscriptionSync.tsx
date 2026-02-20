'use client';

import { useEffect, useRef } from 'react';
import {
    isPushNotificationSupported,
    getNotificationPermission,
    subscribeToPushNotifications,
    safeRepairSubscription,
} from '@/lib/push-notification';

interface Props {
    userType: 'worker' | 'facility_admin';
}

export function PushSubscriptionSync({ userType }: Props) {
    const syncAttempted = useRef(false);

    useEffect(() => {
        if (syncAttempted.current) return;
        syncAttempted.current = true;

        let visibilityTimer: ReturnType<typeof setTimeout> | null = null;
        let visibilityHandler: (() => void) | null = null;

        const syncSubscription = async () => {
            if (typeof window === 'undefined') return;
            if (!isPushNotificationSupported()) return;
            if (getNotificationPermission() !== 'granted') return;

            const result = await subscribeToPushNotifications(userType);

            if (result.success && result.needsRepair) {
                if (result.repairReason === 'age') {
                    // T1: Age-based repair - use visibility guard
                    console.log('[PushSync] Age-based repair needed, waiting for stable visibility...');
                    const startRepairIfVisible = () => {
                        if (document.visibilityState === 'visible') {
                            visibilityTimer = setTimeout(async () => {
                                await safeRepairSubscription(userType);
                                if (visibilityHandler) {
                                    document.removeEventListener('visibilitychange', visibilityHandler);
                                }
                            }, 5000);
                        }
                    };

                    visibilityHandler = () => {
                        if (document.visibilityState === 'hidden' && visibilityTimer) {
                            clearTimeout(visibilityTimer);
                            visibilityTimer = null;
                        } else if (document.visibilityState === 'visible') {
                            startRepairIfVisible();
                        }
                    };

                    document.addEventListener('visibilitychange', visibilityHandler);
                    // If already visible, start timer
                    if (document.visibilityState === 'visible') {
                        startRepairIfVisible();
                    }
                } else {
                    // T2/T3: Version or failure-based repair - run immediately
                    console.log('[PushSync] Server requested repair (reason:', result.repairReason, '), starting...');
                    await safeRepairSubscription(userType);
                }
            } else if (result.success) {
                console.log('[PushSync] Subscription synced successfully');
            } else {
                console.warn('[PushSync] Subscription sync failed:', result.error, result.message);
            }
        };

        const timer = setTimeout(syncSubscription, 3000);
        return () => {
            clearTimeout(timer);
            if (visibilityTimer) clearTimeout(visibilityTimer);
            if (visibilityHandler) {
                document.removeEventListener('visibilitychange', visibilityHandler);
            }
        };
    }, [userType]);

    return null;
}
