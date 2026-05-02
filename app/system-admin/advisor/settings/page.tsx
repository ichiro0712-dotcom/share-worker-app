import { redirect } from 'next/navigation';
import { getAdvisorAuth } from '@/src/lib/advisor/auth';
import {
  getSettings,
  getDataSources,
  getToolList,
  getMonthlyUsage,
} from '@/src/lib/advisor/actions/settings';
import { SettingsClient } from '@/src/components/advisor/settings/settings-client';

export const dynamic = 'force-dynamic';

export default async function AdvisorSettingsPage() {
  const auth = await getAdvisorAuth();
  if (!auth) {
    redirect('/system-admin/login');
  }

  const [settings, dataSources, tools, monthlyUsage] = await Promise.all([
    getSettings(),
    getDataSources(),
    getToolList(),
    getMonthlyUsage(),
  ]);

  return (
    <SettingsClient
      initialSettings={settings.current}
      defaultPromptText={settings.defaultPromptText}
      dataSources={dataSources}
      tools={tools}
      monthlyUsage={monthlyUsage}
    />
  );
}
