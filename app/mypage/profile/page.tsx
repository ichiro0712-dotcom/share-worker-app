import { getUserProfile } from '@/src/lib/actions';
import { getPublishedExperienceFields } from '@/src/lib/content-actions';
import ProfileEditClient from './ProfileEditClient';
import { redirect } from 'next/navigation';

// 動的レンダリングを強制（セッションを使用するため）
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [userProfile, experienceFieldGroups] = await Promise.all([
    getUserProfile(),
    getPublishedExperienceFields(),
  ]);

  if (!userProfile) {
    redirect('/');
  }

  return (
    <ProfileEditClient
      userProfile={userProfile}
      experienceFieldGroups={experienceFieldGroups}
    />
  );
}
