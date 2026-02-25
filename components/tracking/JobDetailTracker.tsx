'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { trackGA4Event } from '@/src/lib/ga4-events';

interface JobDetailTrackerProps {
  jobId: number;
}

export default function JobDetailTracker({ jobId }: JobDetailTrackerProps) {
  const { data: session } = useSession();
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (hasSentRef.current || !session?.user?.id) return;

    let cancelled = false;

    fetch('/api/job-detail-tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
      keepalive: true,
    }).then(() => {
      if (!cancelled) {
        hasSentRef.current = true;
        trackGA4Event('job_detail_view', { job_id: jobId });
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [session, jobId]);

  return null;
}
