'use client';

import AnnouncementForm from '@/components/system-admin/AnnouncementForm';

export default function EditAnnouncementPage({ params }: { params: { id: string } }) {
    return <AnnouncementForm mode="edit" announcementId={parseInt(params.id)} />;
}
