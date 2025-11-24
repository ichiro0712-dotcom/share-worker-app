import { getJobById, getJobs } from '@/src/lib/actions';
import { JobDetailClient } from '@/components/job/JobDetailClient';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetail({ params }: PageProps) {
  const { id } = await params;
  const jobData = await getJobById(id);

  if (!jobData) {
    notFound();
  }

  // 同じ施設の他の求人を取得
  const allJobsData = await getJobs();
  const relatedJobsData = allJobsData.filter(
    (j) => j.facility_id === jobData.facility_id && j.id !== jobData.id
  );

  // DBのデータをフロントエンドの型に変換（既に文字列化済み）
  const job = {
    id: jobData.id,
    status: jobData.status.toLowerCase() as 'published' | 'draft' | 'stopped' | 'working' | 'completed' | 'cancelled',
    facilityId: jobData.facility_id,
    title: jobData.title,
    workDate: jobData.work_date.split('T')[0],
    startTime: jobData.start_time,
    endTime: jobData.end_time,
    breakTime: jobData.break_time,
    wage: jobData.wage,
    hourlyWage: jobData.hourly_wage,
    deadline: jobData.deadline,
    tags: jobData.tags,
    address: jobData.address,
    access: jobData.access,
    recruitmentCount: jobData.recruitment_count,
    appliedCount: jobData.applied_count,
    transportationFee: jobData.transportation_fee,
    overview: jobData.overview,
    workContent: jobData.work_content,
    requiredQualifications: jobData.required_qualifications,
    requiredExperience: jobData.required_experience,
    dresscode: jobData.dresscode,
    belongings: jobData.belongings,
    managerName: jobData.manager_name,
    managerMessage: jobData.manager_message || '',
    managerAvatar: jobData.manager_avatar || '👤',
    images: jobData.images,
    badges: [],
    otherConditions: [],
    mapImage: '/images/map-placeholder.png',
    transportMethods: [],
    parking: false,
    accessDescription: jobData.access,
  };

  const facility = {
    id: jobData.facility.id,
    name: jobData.facility.facility_name,
    corporationName: jobData.facility.corporation_name,
    type: jobData.facility.facility_type,
    address: jobData.facility.address,
    lat: jobData.facility.lat,
    lng: jobData.facility.lng,
    phoneNumber: jobData.facility.phone_number,
    description: jobData.facility.description || '',
    images: jobData.facility.images,
    rating: jobData.facility.rating,
    reviewCount: jobData.facility.review_count,
  };

  const relatedJobs = relatedJobsData.map((relatedJob) => ({
    id: relatedJob.id,
    status: relatedJob.status.toLowerCase() as 'published' | 'draft' | 'stopped' | 'working' | 'completed' | 'cancelled',
    facilityId: relatedJob.facility_id,
    title: relatedJob.title,
    workDate: relatedJob.work_date.split('T')[0],
    startTime: relatedJob.start_time,
    endTime: relatedJob.end_time,
    breakTime: relatedJob.break_time,
    wage: relatedJob.wage,
    hourlyWage: relatedJob.hourly_wage,
    deadline: relatedJob.deadline,
    tags: relatedJob.tags,
    address: relatedJob.address,
    access: relatedJob.access,
    recruitmentCount: relatedJob.recruitment_count,
    appliedCount: relatedJob.applied_count,
    transportationFee: relatedJob.transportation_fee,
  }));

  // レビューデータは後で実装
  const facilityReviews: any[] = [];

  return (
    <JobDetailClient
      job={job}
      facility={facility}
      relatedJobs={relatedJobs}
      facilityReviews={facilityReviews}
    />
  );
}
