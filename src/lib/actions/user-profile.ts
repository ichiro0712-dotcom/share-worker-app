'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, FileBlob } from './helpers';
import { geocodeAddress } from '@/src/lib/geocoding';
import { uploadFile, STORAGE_BUCKETS } from '@/lib/supabase';
import { logActivity, getErrorMessage, getErrorStack } from '@/lib/logger';
import { generateBankAccountName } from '@/lib/string-utils';

/**
 * プロフィールの完成状態をチェックする
 */
export async function checkProfileComplete(userId: number) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        return { isComplete: false, missingFields: ['ユーザー情報'] };
    }

    const requiredFields = [
        { key: 'last_name_kana', label: 'フリガナ（セイ）' },
        { key: 'first_name_kana', label: 'フリガナ（メイ）' },
        { key: 'gender', label: '性別' },
        { key: 'nationality', label: '国籍' },
        { key: 'postal_code', label: '郵便番号' },
        { key: 'prefecture', label: '都道府県' },
        { key: 'city', label: '市区町村' },
        { key: 'address_line', label: '番地' },
        { key: 'phone_number', label: '電話番号' },
        // 緊急連絡先
        { key: 'emergency_name', label: '緊急連絡先氏名' },
        { key: 'emergency_phone', label: '緊急連絡先電話番号' },
        // 働き方と希望
        { key: 'current_work_style', label: '現在の働き方' },
        { key: 'desired_work_style', label: '希望の働き方' },
        // 銀行口座情報
        { key: 'bank_name', label: '銀行名' },
        { key: 'branch_name', label: '支店名' },
        { key: 'account_name', label: '口座名義' },
        { key: 'account_number', label: '口座番号' },
        { key: 'bank_book_image', label: '通帳コピー' },
        // 身分証明書
        { key: 'id_document', label: '身分証明書' },
    ];

    const missingFields: string[] = [];

    for (const field of requiredFields) {
        if (!user[field.key as keyof typeof user]) {
            missingFields.push(field.label);
        }
    }

    if (!user.experience_fields) {
        missingFields.push('経験・スキル');
    }

    // 資格チェック（少なくとも1つの資格が登録されていること）
    if (!user.qualifications || user.qualifications.length === 0) {
        missingFields.push('保有資格');
    }

    // 資格証明書チェック（「その他」以外の資格には証明書が必要）
    const qualificationsNeedingCertificates = (user.qualifications || []).filter(
        (qual: string) => qual !== 'その他'
    );
    if (qualificationsNeedingCertificates.length > 0) {
        const certificates = user.qualification_certificates as Record<string, string> | null;
        const missingCertificates: string[] = [];
        for (const qual of qualificationsNeedingCertificates) {
            if (!certificates || !certificates[qual]) {
                missingCertificates.push(qual);
            }
        }
        if (missingCertificates.length > 0) {
            missingFields.push(`資格証明書（${missingCertificates.join('、')}）`);
        }
    }

    return {
        isComplete: missingFields.length === 0,
        missingFields,
    };
}

export async function getUserProfile() {
    try {
        // テスト運用中の認証済みユーザーを取得
        const user = await getAuthenticatedUser();
        console.log('[getUserProfile] Fetching profile for user:', user.id);

        // Date型を文字列に変換してシリアライズ可能にする
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            birth_date: user.birth_date ? user.birth_date.toISOString() : null,
            phone_number: user.phone_number,
            profile_image: user.profile_image,
            qualifications: user.qualifications,
            created_at: user.created_at.toISOString(),
            updated_at: user.updated_at.toISOString(),
            // 追加フィールド
            last_name_kana: user.last_name_kana,
            first_name_kana: user.first_name_kana,
            gender: user.gender,
            nationality: user.nationality,
            // 住所
            postal_code: user.postal_code,
            prefecture: user.prefecture,
            city: user.city,
            address_line: user.address_line,
            building: user.building,
            // 緊急連絡先
            emergency_name: user.emergency_name,
            emergency_relation: user.emergency_relation,
            emergency_phone: user.emergency_phone,
            emergency_address: user.emergency_address,
            // 働き方・希望
            current_work_style: user.current_work_style,
            desired_work_style: user.desired_work_style,
            job_change_desire: user.job_change_desire,
            desired_work_days_week: user.desired_work_days_week,
            desired_work_period: user.desired_work_period,
            desired_work_days: user.desired_work_days,
            desired_start_time: user.desired_start_time,
            desired_end_time: user.desired_end_time,
            // 経験
            experience_fields: user.experience_fields as Record<string, string> | null,
            work_histories: user.work_histories,
            // 自己PR
            self_pr: user.self_pr,
            // 銀行口座
            bank_code: user.bank_code,
            bank_name: user.bank_name,
            branch_code: user.branch_code,
            branch_name: user.branch_name,
            account_name: user.account_name,
            account_number: user.account_number,
            // その他
            pension_number: user.pension_number,
            id_document: user.id_document,
            bank_book_image: user.bank_book_image,
            // 資格証明書
            qualification_certificates: user.qualification_certificates as Record<string, string> | null,
        };
    } catch (error) {
        console.error('[getUserProfile] Error:', error);
        return null;
    }
}

// 自己PRのみを取得する軽量な関数
export async function getUserSelfPR(): Promise<{ selfPR: string | null } | null> {
    try {
        const user = await getAuthenticatedUser();

        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: { self_pr: true },
        });

        return { selfPR: userData?.self_pr || null };
    } catch {
        return null;
    }
}

// 自己PRのみを更新する関数
export async function updateUserSelfPR(selfPR: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getAuthenticatedUser();

        await prisma.user.update({
            where: { id: user.id },
            data: { self_pr: selfPR.trim() || null, updated_by_type: 'WORKER', updated_by_id: user.id },
        });

        return { success: true };
    } catch (error) {
        console.error('[updateUserSelfPR] Error:', error);
        return { success: false, error: '自己PRの更新に失敗しました' };
    }
}

export async function updateUserProfile(formData: FormData) {
    console.log('[updateUserProfile] Function called');
    try {
        // テスト運用中の認証済みユーザーを取得
        console.log('[updateUserProfile] Getting authenticated user...');
        const user = await getAuthenticatedUser();
        console.log('[updateUserProfile] Updating profile for user:', user.id);

        // FormDataから値を取得
        const name = formData.get('name') as string;
        const email = formData.get('email') as string;
        const phoneNumber = formData.get('phoneNumber') as string;
        const birthDate = formData.get('birthDate') as string;
        const qualificationsStr = formData.get('qualifications') as string;
        const profileImageFile = formData.get('profileImage') as FileBlob | null;

        // 追加フィールド
        const lastNameKana = formData.get('lastNameKana') as string | null;
        const firstNameKana = formData.get('firstNameKana') as string | null;
        const gender = formData.get('gender') as string | null;
        const nationality = formData.get('nationality') as string | null;

        // 住所
        const postalCode = formData.get('postalCode') as string | null;
        const prefecture = formData.get('prefecture') as string | null;
        const city = formData.get('city') as string | null;
        const addressLine = formData.get('addressLine') as string | null;
        const building = formData.get('building') as string | null;

        // 緊急連絡先
        const emergencyName = formData.get('emergencyName') as string | null;
        const emergencyRelation = formData.get('emergencyRelation') as string | null;
        const emergencyPhone = formData.get('emergencyPhone') as string | null;
        const emergencyAddress = formData.get('emergencyAddress') as string | null;

        // 働き方・希望
        const currentWorkStyle = formData.get('currentWorkStyle') as string | null;
        const desiredWorkStyle = formData.get('desiredWorkStyle') as string | null;
        const jobChangeDesire = formData.get('jobChangeDesire') as string | null;
        const desiredWorkDaysPerWeek = formData.get('desiredWorkDaysPerWeek') as string | null;
        const desiredWorkPeriod = formData.get('desiredWorkPeriod') as string | null;
        const desiredWorkDaysStr = formData.get('desiredWorkDays') as string | null;
        const desiredStartTime = formData.get('desiredStartTime') as string | null;
        const desiredEndTime = formData.get('desiredEndTime') as string | null;

        // 経験
        const experienceFieldsStr = formData.get('experienceFields') as string | null;
        const workHistoriesStr = formData.get('workHistories') as string | null;

        // 自己PR
        const selfPR = formData.get('selfPR') as string | null;

        // 銀行口座
        const bankCode = formData.get('bankCode') as string | null;
        const bankName = formData.get('bankName') as string | null;
        const branchCode = formData.get('branchCode') as string | null;
        const branchName = formData.get('branchName') as string | null;
        const accountName = formData.get('accountName') as string | null;
        const accountNumber = formData.get('accountNumber') as string | null;

        // その他
        const pensionNumber = formData.get('pensionNumber') as string | null;

        // 新しいフィールド（ファイルとして取得）
        const idDocumentFile = formData.get('idDocument') as FileBlob | null;
        const bankBookImageFile = formData.get('bankBookImage') as FileBlob | null;

        // 資格は配列に変換
        const qualifications = qualificationsStr ? qualificationsStr.split(',').filter(q => q.trim()) : [];

        // 資格証明書ファイルを取得
        const qualificationCertificateFiles: Record<string, FileBlob> = {};
        const entries = Array.from(formData.entries());
        for (const [key, value] of entries) {
            if (key.startsWith('qualificationCertificate_') && value instanceof Blob && value.size > 0) {
                const encodedQualification = key.replace('qualificationCertificate_', '');
                try {
                    // Base64デコード -> UTF-8デコード（Node.js用）
                    const qualification = Buffer.from(encodedQualification, 'base64').toString('utf-8');
                    qualificationCertificateFiles[qualification] = value as FileBlob;
                } catch (decodeError) {
                    console.error('[updateUserProfile] Failed to decode qualification:', decodeError);
                }
            }
        }

        // 希望曜日は配列に変換
        const desiredWorkDays = desiredWorkDaysStr ? desiredWorkDaysStr.split(',').filter(d => d.trim()) : [];

        // 職歴は配列に変換（|||で区切り）
        const workHistories = workHistoriesStr ? workHistoriesStr.split('|||').filter(h => h.trim()) : [];

        // 経験分野はJSONパース
        let experienceFields: Record<string, string> | null = null;
        if (experienceFieldsStr) {
            try {
                experienceFields = JSON.parse(experienceFieldsStr);
            } catch {
                experienceFields = null;
            }
        }

        // バリデーション
        if (!name || !email || !phoneNumber) {
            return {
                success: false,
                error: '必須項目を入力してください',
            };
        }

        // Supabase Storage用ヘルパー関数
        const uploadToSupabaseStorage = async (file: FileBlob, folder: string, prefix: string, userId: number): Promise<{ url: string } | { error: string }> => {
            try {
                const timestamp = Date.now();
                const fileExtension = file.name.split('.').pop();
                const fileName = `${folder}/${prefix}-${userId}-${timestamp}.${fileExtension}`;

                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                const result = await uploadFile(
                    STORAGE_BUCKETS.UPLOADS,
                    fileName,
                    buffer,
                    file.type
                );

                if ('error' in result) {
                    console.error('[Profile Upload] Upload failed:', result.error);
                    return { error: result.error };
                }

                return { url: result.url };
            } catch (error) {
                console.error('[Profile Upload] Unexpected error:', error);
                return { error: error instanceof Error ? error.message : '画像のアップロードに失敗しました' };
            }
        };

        // プロフィール画像のアップロード処理
        let profileImagePath = user.profile_image;

        if (profileImageFile && profileImageFile.size > 0) {
            const uploadResult = await uploadToSupabaseStorage(profileImageFile, 'profiles', 'profile', user.id);
            if ('error' in uploadResult) {
                return {
                    success: false,
                    error: `プロフィール画像のアップロードに失敗しました: ${uploadResult.error}`,
                };
            }
            profileImagePath = uploadResult.url;
        }

        // 身分証明書のアップロード処理
        let idDocumentPath = user.id_document;
        if (idDocumentFile && idDocumentFile.size > 0) {
            const uploadResult = await uploadToSupabaseStorage(idDocumentFile, 'documents', 'id-document', user.id);
            if ('error' in uploadResult) {
                return {
                    success: false,
                    error: `身分証明書のアップロードに失敗しました: ${uploadResult.error}`,
                };
            }
            idDocumentPath = uploadResult.url;
        }

        // 通帳コピーのアップロード処理
        let bankBookImagePath = user.bank_book_image;
        if (bankBookImageFile && bankBookImageFile.size > 0) {
            const uploadResult = await uploadToSupabaseStorage(bankBookImageFile, 'documents', 'bank-book', user.id);
            if ('error' in uploadResult) {
                return {
                    success: false,
                    error: `通帳コピーのアップロードに失敗しました: ${uploadResult.error}`,
                };
            }
            bankBookImagePath = uploadResult.url;
        }

        // 資格証明書のアップロード処理
        const rawCertificates = (user.qualification_certificates as Record<string, unknown>) || {};
        const existingCertificates: Record<string, string> = {};

        for (const [key, value] of Object.entries(rawCertificates)) {
            if (typeof value === 'string') {
                existingCertificates[key] = value;
            } else if (value && typeof value === 'object' && 'certificate_image' in value) {
                const certImage = (value as { certificate_image?: string }).certificate_image;
                if (certImage && typeof certImage === 'string') {
                    existingCertificates[key] = certImage;
                }
            }
        }
        const newCertificates: Record<string, string> = { ...existingCertificates };

        for (const [qualification, file] of Object.entries(qualificationCertificateFiles)) {
            const encodedQualName = Buffer.from(qualification).toString('base64').replace(/[+/=]/g, '_');
            const uploadResult = await uploadToSupabaseStorage(file, 'certificates', `cert-${encodedQualName}`, user.id);
            if ('error' in uploadResult) {
                return {
                    success: false,
                    error: `資格証明書（${qualification}）のアップロードに失敗しました: ${uploadResult.error}`,
                };
            }
            newCertificates[qualification] = uploadResult.url;
        }

        // 住所が変更された場合（または入力がある場合）、ジオコーディングを実行
        let lat: number | null = user.lat;
        let lng: number | null = user.lng;

        const newPrefecture = prefecture || user.prefecture;
        const newCity = city || user.city;
        const newAddressLine = addressLine || user.address_line;

        if (newPrefecture || newCity || newAddressLine) {
            const fullAddress = `${newPrefecture || ''}${newCity || ''}${newAddressLine || ''}`;
            if (fullAddress.length > 0) {
                try {
                    const location = await geocodeAddress(fullAddress);
                    if (location) {
                        lat = location.lat;
                        lng = location.lng;
                    }
                } catch (geoError) {
                    console.error('[updateUserProfile] Geocoding failed:', geoError);
                }
            }
        }

        // プロフィール更新
        await prisma.user.update({
            where: { id: user.id },
            data: {
                name,
                email,
                phone_number: phoneNumber,
                birth_date: birthDate ? new Date(birthDate) : null,
                qualifications,
                profile_image: profileImagePath,
                last_name_kana: lastNameKana || null,
                first_name_kana: firstNameKana || null,
                gender: gender || null,
                nationality: nationality || null,
                postal_code: postalCode || null,
                prefecture: prefecture || null,
                city: city || null,
                address_line: addressLine || null,
                building: building || null,
                lat,
                lng,
                emergency_name: emergencyName || null,
                emergency_relation: emergencyRelation || null,
                emergency_phone: emergencyPhone || null,
                emergency_address: emergencyAddress || null,
                current_work_style: currentWorkStyle || null,
                desired_work_style: desiredWorkStyle || null,
                job_change_desire: jobChangeDesire || null,
                desired_work_days_week: desiredWorkDaysPerWeek,
                desired_work_period: desiredWorkPeriod || null,
                desired_work_days: desiredWorkDays,
                desired_start_time: desiredStartTime || null,
                desired_end_time: desiredEndTime || null,
                experience_fields: experienceFields || undefined,
                work_histories: workHistories,
                self_pr: selfPR || null,
                bank_code: bankCode || null,
                bank_name: bankName || null,
                branch_code: branchCode || null,
                branch_name: branchName || null,
                // 口座名義は姓名カナから自動生成（小文字カタカナは大文字に変換）
                account_name: generateBankAccountName(lastNameKana || '', firstNameKana || '') || null,
                account_number: accountNumber || null,
                pension_number: pensionNumber || null,
                id_document: idDocumentPath,
                bank_book_image: bankBookImagePath,
                qualification_certificates: Object.keys(newCertificates).length > 0 ? newCertificates : undefined,
                // 更新者追跡
                updated_by_type: 'WORKER',
                updated_by_id: user.id,
            },
        });

        // プロフィール関連ページのキャッシュを無効化
        revalidatePath('/mypage/profile');
        revalidatePath('/mypage');

        // プロフィール更新成功をログ記録
        logActivity({
            userType: 'WORKER',
            userId: user.id,
            userEmail: user.email,
            action: 'PROFILE_UPDATE',
            targetType: 'User',
            targetId: user.id,
            requestData: {
                name,
                email,
                phoneNumber,
                prefecture,
                city,
                qualificationsCount: qualifications.length,
                hasProfileImage: !!profileImagePath,
                hasIdDocument: !!idDocumentPath,
                hasBankBookImage: !!bankBookImagePath,
            },
            result: 'SUCCESS',
        }).catch(() => {});

        return {
            success: true,
            message: 'プロフィールを更新しました',
        };
    } catch (error) {
        console.error('[updateUserProfile] Error caught:', error);
        console.error('[updateUserProfile] Error type:', typeof error);
        console.error('[updateUserProfile] Error name:', error instanceof Error ? error.name : 'Not an Error instance');
        console.error('[updateUserProfile] Error message:', error instanceof Error ? error.message : String(error));

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // プロフィール更新失敗をログ記録（非同期、エラーは無視）
        try {
            logActivity({
                userType: 'WORKER',
                action: 'PROFILE_UPDATE_FAILED',
                result: 'ERROR',
                errorMessage: getErrorMessage(error),
                errorStack: getErrorStack(error),
            }).catch(() => {});
        } catch {
            // ログ記録自体のエラーは無視
        }

        console.log('[updateUserProfile] Returning error response');
        return {
            success: false,
            error: `プロフィールの更新に失敗しました: ${errorMessage}`,
        };
    }
}
