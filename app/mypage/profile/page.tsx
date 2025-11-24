import { getUserProfile } from '@/src/lib/actions';
import ProfileEditClient from './ProfileEditClient';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const userProfile = await getUserProfile();

  if (!userProfile) {
    redirect('/');
  }

  return <ProfileEditClient userProfile={userProfile} />;
}
