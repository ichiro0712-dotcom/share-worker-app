'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { getAuthenticatedUser } from './helpers';
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';

/**
 * 施設IDから施設情報を取得
 */
export async function getFacilityById(facilityId: number) {
    try {
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
        });
        return facility;
    } catch (error) {
        console.error('[getFacilityById] Error:', error);
        return null;
    }
}

/**
 * 施設IDから求人リストを取得（ワーカー向け）
 */
export async function getJobsByFacilityId(facilityId: number) {
    try {
        const jobs = await prisma.job.findMany({
            where: {
                facility_id: facilityId,
                status: 'PUBLISHED',
            },
            include: {
                facility: true,
                workDates: {
                    orderBy: { work_date: 'asc' },
                },
            },
            orderBy: {
                created_at: 'desc',
            },
        });

        return jobs.map((job) => {
            const nearestWorkDate = job.workDates.length > 0 ? job.workDates[0] : null;
            const totalAppliedCount = job.workDates.reduce((sum, wd) => sum + wd.applied_count, 0);

            return {
                ...job,
                work_date: nearestWorkDate ? nearestWorkDate.work_date : null,
                deadline: nearestWorkDate ? nearestWorkDate.deadline : null,
                applied_count: totalAppliedCount,
            };
        });
    } catch (error) {
        console.error('[getJobsByFacilityId] Error:', error);
        return [];
    }
}

/**
 * 施設のお気に入り状態をトグル
 */
export async function toggleFacilityFavorite(facilityId: string) {
    try {
        const user = await getAuthenticatedUser();
        const facilityIdNum = parseInt(facilityId);

        const existingFavorite = await prisma.bookmark.findFirst({
            where: {
                user_id: user.id,
                type: 'FAVORITE',
                target_facility_id: facilityIdNum,
            },
        });

        if (existingFavorite) {
            await prisma.bookmark.delete({
                where: { id: existingFavorite.id },
            });

            // ログ記録（お気に入り解除）
            logActivity({
                userType: 'WORKER',
                userId: user.id,
                action: 'BOOKMARK_DELETE',
                targetType: 'Bookmark',
                targetId: existingFavorite.id,
                requestData: {
                    facilityId: facilityIdNum,
                    bookmarkType: 'FAVORITE',
                },
                result: 'SUCCESS',
            }).catch(() => {});

            return { success: true, isFavorite: false };
        } else {
            const bookmark = await prisma.bookmark.create({
                data: {
                    user_id: user.id,
                    type: 'FAVORITE',
                    target_facility_id: facilityIdNum,
                },
            });

            // ログ記録（お気に入り追加）
            logActivity({
                userType: 'WORKER',
                userId: user.id,
                action: 'BOOKMARK_CREATE',
                targetType: 'Bookmark',
                targetId: bookmark.id,
                requestData: {
                    facilityId: facilityIdNum,
                    bookmarkType: 'FAVORITE',
                },
                result: 'SUCCESS',
            }).catch(() => {});

            return { success: true, isFavorite: true };
        }
    } catch (error) {
        console.error('[toggleFacilityFavorite] Error:', error);

        // エラーログ記録
        logActivity({
            userType: 'WORKER',
            action: 'BOOKMARK_CREATE',
            requestData: {
                facilityId,
                bookmarkType: 'FAVORITE',
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: 'お気に入りの更新に失敗しました' };
    }
}

/**
 * 施設がお気に入り登録されているかチェック
 */
export async function isFacilityFavorited(facilityId: string) {
    try {
        const user = await getAuthenticatedUser();
        const facilityIdNum = parseInt(facilityId);

        const favorite = await prisma.bookmark.findFirst({
            where: {
                user_id: user.id,
                type: 'FAVORITE',
                target_facility_id: facilityIdNum,
            },
        });

        return !!favorite;
    } catch (error) {
        console.error('[isFacilityFavorited] Error:', error);
        return false;
    }
}

/**
 * ユーザーのお気に入り施設一覧を取得
 */
export async function getFavoriteFacilities() {
    try {
        const user = await getAuthenticatedUser();

        const favorites = await prisma.bookmark.findMany({
            where: {
                user_id: user.id,
                type: 'FAVORITE',
                target_facility_id: { not: null },
            },
            include: {
                targetFacility: true,
            },
            orderBy: {
                created_at: 'desc',
            },
        });

        return favorites
            .filter((fav) => fav.targetFacility !== null)
            .map((fav) => ({
                favoriteId: fav.id,
                addedAt: fav.created_at.toISOString(),
                facility: fav.targetFacility!,
            }));
    } catch (error) {
        console.error('[getFavoriteFacilities] Error:', error);
        return [];
    }
}

/**
 * 施設詳細情報を取得（施設管理画面用）
 */
export async function getFacilityInfo(facilityId: number) {
    const facility = await prisma.facility.findUnique({
        where: { id: facilityId },
    });

    if (!facility) return null;

    return {
        id: facility.id,
        isPending: facility.is_pending || false,
        corporationName: facility.corporation_name,
        facilityName: facility.facility_name,
        facilityType: facility.facility_type,
        address: facility.address,
        lat: facility.lat,
        lng: facility.lng,
        phoneNumber: facility.phone_number,
        description: facility.description,
        images: facility.images,
        mapImage: facility.map_image,
        rating: facility.rating,
        reviewCount: facility.review_count,
        initialMessage: facility.initial_message,
        representativeLastName: facility.representative_last_name,
        representativeFirstName: facility.representative_first_name,
        email: facility.email,
        contactPersonLastName: facility.contact_person_last_name,
        contactPersonFirstName: facility.contact_person_first_name,
        corporationNumber: facility.corporation_number,
        corpPostalCode: facility.corp_postal_code,
        corpPrefecture: facility.corp_prefecture,
        corpCity: facility.corp_city,
        corpAddressLine: facility.corp_address_line,
        postalCode: facility.postal_code,
        prefecture: facility.prefecture,
        city: facility.city,
        addressDetail: facility.address_line || facility.address_detail,
        addressLine: facility.address_line,
        managerLastName: facility.manager_last_name,
        managerFirstName: facility.manager_first_name,
        managerPhone: facility.manager_phone,
        managerEmail: facility.manager_email,
        staffSameAsManager: facility.staff_same_as_manager,
        staffLastName: facility.staff_last_name,
        staffFirstName: facility.staff_first_name,
        staffPhone: facility.staff_phone,
        staffEmail: facility.staff_email,
        staffEmails: facility.staff_emails,
        staffPhoto: null, // 担当者顔写真は廃止（ID-13）
        staffGreeting: facility.staff_greeting,
        emergencyContact: facility.emergency_contact,
        stations: facility.stations as { name: string; minutes: number }[] | null,
        accessDescription: facility.access_description,
        transportation: facility.transportation,
        parking: facility.parking,
        transportationNote: facility.transportation_note,
        dresscodeItems: facility.dresscode_items,
        dresscodeImages: facility.dresscode_images,
        smokingMeasure: facility.smoking_measure,
        workInSmokingArea: facility.work_in_smoking_area,
    };
}

/**
 * 施設の初回メッセージを更新
 */
export async function updateFacilityInitialMessage(facilityId: number, initialMessage: string) {
    try {
        await prisma.facility.update({
            where: { id: facilityId },
            data: { initial_message: initialMessage },
        });
        revalidatePath('/admin/facility');
        revalidateTag(`facility-${facilityId}`);

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                field: 'initial_message',
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true };
    } catch (error) {
        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                field: 'initial_message',
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: 'Failed to update initial message' };
    }
}

/**
 * 施設の担当者名を取得（サイドバー表示用）
 */
export async function getFacilityStaffName(facilityId: number) {
    try {
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { staff_last_name: true, staff_first_name: true, facility_name: true },
        });
        if (!facility) return null;
        return facility.staff_last_name && facility.staff_first_name
            ? `${facility.staff_last_name} ${facility.staff_first_name}`
            : facility.staff_last_name || facility.staff_first_name || facility.facility_name || '担当者';
    } catch (error) {
        return null;
    }
}

/**
 * 施設情報を更新
 */
export async function updateFacilityBasicInfo(facilityId: number, data: any) {
    try {
        await prisma.facility.update({
            where: { id: facilityId },
            data: {
                corporation_name: data.corporationName,
                facility_name: data.facilityName,
                facility_type: data.facilityType,
                initial_message: data.initialMessage,
                representative_last_name: data.representativeLastName,
                representative_first_name: data.representativeFirstName,
                phone_number: data.phone,
                email: data.email,
                contact_person_last_name: data.contactPersonLastName,
                contact_person_first_name: data.contactPersonFirstName,
                corporation_number: data.corporationNumber,
                corp_postal_code: data.corpPostalCode,
                corp_prefecture: data.corpPrefecture,
                corp_city: data.corpCity,
                corp_address_line: data.corpAddressLine,
                postal_code: data.postalCode,
                prefecture: data.prefecture,
                city: data.city,
                address_line: data.addressLine,
                address_detail: data.addressLine,
                manager_last_name: data.managerLastName,
                manager_first_name: data.managerFirstName,
                manager_phone: data.managerPhone,
                manager_email: data.managerEmail,
                staff_same_as_manager: data.staffSameAsManager,
                staff_last_name: data.staffLastName,
                staff_first_name: data.staffFirstName,
                staff_phone: data.staffPhone,
                staff_email: data.staffEmail,
                staff_emails: data.staffEmails,
                // staff_photo は廃止（ID-13）
                staff_greeting: data.staffGreeting,
                emergency_contact: data.emergencyContact,
                stations: data.stations,
                access_description: data.accessDescription,
                transportation: data.transportation,
                parking: data.parking,
                transportation_note: data.transportationNote,
                map_image: data.mapImage,
                images: data.images,
                dresscode_items: data.dresscodeItems,
                dresscode_images: data.dresscodeImages,
                smoking_measure: data.smokingMeasure,
                work_in_smoking_area: data.workInSmokingArea,
                is_pending: false,
            },
        });
        revalidateTag(`facility-${facilityId}`);

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                facilityName: data.facilityName,
                corporationName: data.corporationName,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true, isPendingCleared: true };
    } catch (error) {
        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                facilityName: data.facilityName,
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: 'Failed to update facility' };
    }
}

/**
 * 施設の地図画像を取得・保存
 */
export async function updateFacilityMapImage(facilityId: number, address: string) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) return { success: false, error: 'Google Maps APIキーが設定されていません' };

        const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
        mapUrl.searchParams.set('center', address);
        mapUrl.searchParams.set('zoom', '16');
        mapUrl.searchParams.set('size', '600x300');
        mapUrl.searchParams.set('scale', '2');
        mapUrl.searchParams.set('markers', `color:red|${address}`);
        mapUrl.searchParams.set('key', apiKey);

        const response = await fetch(mapUrl.toString());
        if (!response.ok) return { success: false, error: '地図画像の取得に失敗しました' };

        const imageBuffer = await response.arrayBuffer();
        const fileName = `maps/facility-${facilityId}-${Date.now()}.png`;

        const result = await uploadFile(STORAGE_BUCKETS.UPLOADS, fileName, Buffer.from(imageBuffer), 'image/png');
        if ('error' in result) return { success: false, error: '地図画像の保存に失敗しました' };

        return { success: true, mapImage: result.url };
    } catch (error) {
        return { success: false, error: 'Failed to update map image' };
    }
}

/**
 * 施設の緯度経度を更新
 */
export async function updateFacilityLatLng(facilityId: number, lat: number, lng: number) {
    try {
        await prisma.facility.update({ where: { id: facilityId }, data: { lat, lng } });
        revalidatePath('/admin/facility');

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                field: 'lat_lng',
                lat,
                lng,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true };
    } catch (error) {
        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                field: 'lat_lng',
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: '緯度経度の更新に失敗しました' };
    }
}

/**
 * 緯度経度から地図画像を更新
 */
export async function updateFacilityMapImageByLatLng(facilityId: number, lat: number, lng: number) {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) return { success: false, error: 'Google Maps APIキーが設定されていません' };

        const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
        mapUrl.searchParams.set('center', `${lat},${lng}`);
        mapUrl.searchParams.set('zoom', '16');
        mapUrl.searchParams.set('size', '600x300');
        mapUrl.searchParams.set('scale', '2');
        mapUrl.searchParams.set('markers', `color:red|${lat},${lng}`);
        mapUrl.searchParams.set('key', apiKey);

        const response = await fetch(mapUrl.toString());
        if (!response.ok) return { success: false, error: '地図画像の取得に失敗しました' };

        const imageBuffer = await response.arrayBuffer();
        const fileName = `maps/facility-${facilityId}-${Date.now()}.png`;

        const result = await uploadFile(STORAGE_BUCKETS.UPLOADS, fileName, Buffer.from(imageBuffer), 'image/png');
        if ('error' in result) return { success: false, error: '地図画像の保存に失敗しました' };

        await prisma.facility.update({ where: { id: facilityId }, data: { map_image: result.url, lat, lng } });
        revalidatePath('/admin/facility');

        // ログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                field: 'map_image_lat_lng',
                lat,
                lng,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return { success: true, mapImage: result.url };
    } catch (error) {
        // エラーログ記録
        logActivity({
            userType: 'FACILITY',
            action: 'FACILITY_UPDATE',
            targetType: 'Facility',
            targetId: facilityId,
            requestData: {
                field: 'map_image_lat_lng',
            },
            result: 'ERROR',
            errorMessage: getErrorMessage(error),
            errorStack: getErrorStack(error),
        }).catch(() => {});

        return { success: false, error: '地図画像の更新に失敗しました' };
    }
}

/**
 * 施設情報を取得する（キャッシュ版）
 */
export const getCachedFacility = async (id: number) => {
    const cachedFn = unstable_cache(
        async () => {
            const facility = await prisma.facility.findUnique({
                where: { id },
            });
            return facility;
        },
        [`facility-detail-${id}`],
        { tags: [`facility-${id}`] }
    );
    return cachedFn();
};
