import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { headers } from 'next/headers';
import { getPublicJobById } from '@/src/lib/actions/job-public';
import { JobDetailClient } from '@/components/job/JobDetailClient';

interface PageProps {
    params: Promise<{ id: string }>;
}

// OGP/メタデータを動的に生成
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const job = await getPublicJobById(id);

    // ベースURL取得
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = host ? `${protocol}://${host}` : 'https://share-worker-app.vercel.app';

    if (!job) {
        return {
            title: '求人が見つかりません | +タスタス',
            robots: { index: false, follow: false },
        };
    }

    // 職種名を生成（資格から推定）
    const jobType = job.qualifications?.length > 0
        ? job.qualifications[0]
        : '介護・看護スタッフ';

    // 地域名
    const location = `${job.facility.prefecture || ''}${job.facility.city || ''}`;

    // SEO最適化されたタイトル: [職種] [地域]の求人 | 時給○○円 | +タスタス
    const seoTitle = `【${jobType}】${location}の求人 | 時給${job.hourly_wage.toLocaleString()}円 | +タスタス`;

    // 詳細なdescription
    const description = `${location}で${jobType}の求人募集中！時給${job.hourly_wage.toLocaleString()}円、${job.start_time}〜${job.end_time}勤務。${job.facility.name}での${job.qualifications?.join('・') || '資格不問'}のお仕事です。単発・スポットバイトをお探しの方におすすめ。`;

    // キーワード生成
    const keywords = [
        jobType,
        job.facility.prefecture,
        job.facility.city,
        '求人',
        '単発バイト',
        'スポットワーク',
        '介護',
        '看護',
        job.facility.name,
    ].filter(Boolean).join(',');

    return {
        title: seoTitle,
        description,
        keywords,
        authors: [{ name: '+タスタス' }],
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        openGraph: {
            title: seoTitle,
            description,
            type: 'website',
            url: `${baseUrl}/public/jobs/${id}`,
            images: job.images?.[0]
                ? [{ url: job.images[0], width: 1200, height: 630, alt: job.title }]
                : [{ url: `${baseUrl}/images/og-default.png`, width: 1200, height: 630, alt: '+タスタス 求人' }],
            siteName: '+タスタス（タスタス）',
            locale: 'ja_JP',
        },
        twitter: {
            card: 'summary_large_image',
            title: seoTitle,
            description,
            site: '@tastas_jp',
        },
        alternates: {
            canonical: `${baseUrl}/public/jobs/${id}`,
        },
        other: {
            'format-detection': 'telephone=no',
        },
    };
}

export default async function PublicJobDetailPage({ params }: PageProps) {
    const { id } = await params;
    const jobData = await getPublicJobById(id);

    // ベースURL取得
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = host ? `${protocol}://${host}` : 'https://share-worker-app.vercel.app';

    if (!jobData) {
        notFound();
    }

    // 職種名（資格から推定）
    const jobType = jobData.qualifications?.length > 0
        ? jobData.qualifications[0]
        : '介護・看護スタッフ';

    // Google for Jobs 構造化データ (JSON-LD)
    const jobPostingJsonLd = {
        '@context': 'https://schema.org/',
        '@type': 'JobPosting',
        title: jobData.title,
        description: jobData.description || `${jobData.facility.name}での${jobType}のお仕事です。`,
        identifier: {
            '@type': 'PropertyValue',
            name: '+タスタス',
            value: `tastas-job-${jobData.id}`,
        },
        datePosted: jobData.created_at,
        validThrough: jobData.workDates[jobData.workDates.length - 1]?.work_date || jobData.work_date,
        employmentType: 'TEMPORARY',
        hiringOrganization: {
            '@type': 'Organization',
            name: jobData.facility.name,
            sameAs: `${baseUrl}/public/facilities/${jobData.facility.id}`,
            logo: jobData.facility.images?.[0] || `${baseUrl}/images/logo.png`,
        },
        jobLocation: {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                streetAddress: `${jobData.facility.address || ''}${jobData.facility.address_line || ''}`,
                addressLocality: jobData.facility.city || '',
                addressRegion: jobData.facility.prefecture || '',
                addressCountry: 'JP',
            },
            ...(jobData.facility.lat && jobData.facility.lng ? {
                geo: {
                    '@type': 'GeoCoordinates',
                    latitude: jobData.facility.lat,
                    longitude: jobData.facility.lng,
                },
            } : {}),
        },
        baseSalary: {
            '@type': 'MonetaryAmount',
            currency: 'JPY',
            value: {
                '@type': 'QuantitativeValue',
                value: jobData.hourly_wage,
                unitText: 'HOUR',
            },
        },
        workHours: `${jobData.start_time}-${jobData.end_time}`,
        jobBenefits: jobData.transportation_fee && jobData.transportation_fee > 0
            ? `交通費支給（${jobData.transportation_fee.toLocaleString()}円）`
            : undefined,
        qualifications: jobData.qualifications?.join('、') || '資格不問',
        directApply: true,
    };

    // DBのBooleanから移動手段配列を生成
    const transportMethods = [
        { name: '車', available: jobData.allow_car },
    ];

    // DBのデータをフロントエンドの型に変換
    const job = {
        id: jobData.id,
        status: jobData.status as 'published' | 'draft' | 'stopped' | 'working' | 'completed' | 'cancelled',
        facilityId: jobData.facility.id,
        title: jobData.title,
        workDate: jobData.work_date ? jobData.work_date.split('T')[0] : '',
        workDates: jobData.workDates?.map((wd: any) => ({
            id: wd.id,
            workDate: wd.work_date ? wd.work_date.split('T')[0] : '',
            deadline: wd.deadline,
            appliedCount: 0, // 公開版では非表示
            matchedCount: wd.matched_count,
            recruitmentCount: wd.recruitment_count,
        })) || [],
        startTime: jobData.start_time,
        endTime: jobData.end_time,
        breakTime: jobData.break_time,
        wage: jobData.wage,
        hourlyWage: jobData.hourly_wage,
        deadline: jobData.deadline,
        tags: jobData.tags,
        address: jobData.address,
        prefecture: jobData.prefecture,
        city: jobData.city,
        addressLine: jobData.address_line,
        access: jobData.access,
        recruitmentCount: jobData.recruitment_count,
        appliedCount: 0, // 公開版では非表示
        matchedCount: jobData.matched_count,
        transportationFee: jobData.transportation_fee,
        overview: jobData.overview,
        workContent: jobData.work_content,
        requiredQualifications: jobData.required_qualifications,
        requiredExperience: jobData.required_experience,
        dresscode: jobData.dresscode,
        dresscodeImages: jobData.dresscode_images || [],
        belongings: jobData.belongings,
        // 施設の責任者情報を優先、なければ求人の担当者情報を使用
        managerName: jobData.facility.staff_same_as_manager
            ? (jobData.facility.manager_last_name && jobData.facility.manager_first_name
                ? `${jobData.facility.manager_last_name} ${jobData.facility.manager_first_name}`
                : jobData.manager_name)
            : (jobData.facility.staff_last_name && jobData.facility.staff_first_name
                ? `${jobData.facility.staff_last_name} ${jobData.facility.staff_first_name}`
                : jobData.manager_name),
        managerMessage: jobData.facility.staff_greeting || jobData.manager_message || '',
        managerAvatar: jobData.facility.staff_photo || jobData.manager_avatar || '',
        images: jobData.images,
        badges: [],
        mapImage: jobData.facility.map_image || null,
        transportMethods,
        accessDescription: jobData.access,
        featureTags: jobData.feature_tags || [],
        attachments: jobData.attachments || [],
        weeklyFrequency: jobData.weekly_frequency,
        requiresInterview: jobData.requires_interview,
        jobType: jobData.job_type as 'NORMAL' | 'LIMITED_WORKED' | 'LIMITED_FAVORITE' | 'OFFER' | 'ORIENTATION',
    };

    const facility = {
        id: jobData.facility.id,
        name: jobData.facility.facility_name,
        corporationName: jobData.facility.corporation_name,
        type: jobData.facility.facility_type,
        address: jobData.facility.address,
        prefecture: jobData.facility.prefecture,
        city: jobData.facility.city,
        addressLine: jobData.facility.address_line,
        lat: jobData.facility.lat,
        lng: jobData.facility.lng,
        phoneNumber: jobData.facility.phone_number,
        description: jobData.facility.description || '',
        images: jobData.facility.images,
        rating: jobData.facility.rating,
        reviewCount: jobData.facility.review_count,
        stations: jobData.facility.stations || [],
        accessDescription: jobData.facility.access_description || '',
        transportation: jobData.facility.transportation || [],
        parking: jobData.facility.parking || '',
        transportationNote: jobData.facility.transportation_note || '',
    };

    return (
        <>
            {/* Google for Jobs 構造化データ */}
            <Script
                id="job-posting-jsonld"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
            />
            <JobDetailClient
                job={job}
                facility={facility}
                relatedJobs={[]}
                facilityReviews={[]}
                initialHasApplied={false}
                initialAppliedWorkDateIds={[]}
                isPublic={true}
            />
        </>
    );
}
