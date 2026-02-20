import { redirect } from 'next/navigation';

export default function TrackingRedirect() {
  redirect('/system-admin/analytics?tab=lp');
}
