'use client';

import JobForm from '@/components/admin/JobForm';
import { useParams } from 'next/navigation';

export default function EditJobPage() {
  const params = useParams();
  const jobId = params.id as string;

  return <JobForm mode="edit" jobId={jobId} />;
}
