import { getFacilityById, getJobsByFacilityId, isFacilityFavorited, getFacilityReviews } from '@/src/lib/actions';
import { FacilityDetailClient } from '@/components/facility/FacilityDetailClient';
import { notFound } from 'next/navigation';

export default async function FacilityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const facilityId = parseInt(params.id);

  if (isNaN(facilityId)) {
    notFound();
  }

  // DBから施設情報を取得
  const facility = await getFacilityById(facilityId);

  if (!facility) {
    notFound();
  }

  // この施設の求人とレビューを取得
  const [dbJobs, reviews] = await Promise.all([
    getJobsByFacilityId(facilityId),
    getFacilityReviews(facilityId),
  ]);

  // お気に入り状態を取得
  const initialIsFavorite = await isFacilityFavorited(params.id);

  // Prismaの型をJobCard互換に変換
  const jobs = dbJobs.map((job) => ({
    id: job.id,
    facilityId: job.facility_id,
    title: job.title,
    workDate: job.work_date ? job.work_date.toISOString() : '',
    startTime: job.start_time,
    endTime: job.end_time,
    wage: job.wage,
    hourlyWage: job.hourly_wage,
    deadline: job.deadline ? job.deadline.toISOString() : '',
    address: job.facility.address,
    access: job.access,
    distance: 0, // Phase 1では固定値
    images: job.images,
    status: job.status,
    tags: job.tags || [],
  }));

  return (
    <FacilityDetailClient
      facility={facility}
      jobs={jobs}
      initialIsFavorite={initialIsFavorite}
      reviews={reviews}
    />
  );
}
