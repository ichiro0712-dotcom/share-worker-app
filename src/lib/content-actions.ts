'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// ============================================
// システムテンプレート管理
// ============================================

/**
 * 全テンプレートを取得
 */
export async function getSystemTemplates() {
    const templates = await prisma.systemTemplate.findMany({
        orderBy: { key: 'asc' }
    });

    // キーをオブジェクト形式に変換
    const result: Record<string, string> = {};
    templates.forEach(t => {
        result[t.key] = t.value;
    });

    return result;
}

/**
 * 特定のテンプレートを取得
 */
export async function getSystemTemplate(key: string): Promise<string | null> {
    const template = await prisma.systemTemplate.findUnique({
        where: { key }
    });
    return template?.value || null;
}

/**
 * テンプレートを更新
 */
export async function updateSystemTemplate(key: string, value: string) {
    const updated = await prisma.systemTemplate.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    });
    revalidatePath('/system-admin/content/templates');
    return { success: true, template: updated };
}

/**
 * 複数テンプレートを一括更新
 */
export async function updateSystemTemplates(updates: Record<string, string>) {
    const results = await Promise.all(
        Object.entries(updates).map(([key, value]) =>
            prisma.systemTemplate.upsert({
                where: { key },
                update: { value },
                create: { key, value }
            })
        )
    );
    revalidatePath('/system-admin/content/templates');
    revalidatePath('/contact');
    revalidatePath('/admin/facility');
    revalidatePath('/admin/jobs/new');
    return { success: true, count: results.length };
}

// ========== 仕事詳細フォーマット管理 ==========

// フォーマット一覧取得
export async function getJobDescriptionFormats(): Promise<{
    id: number;
    label: string;
    content: string;
    sort_order: number;
    is_active: boolean;
}[]> {
    const formats = await prisma.jobDescriptionFormat.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
    });
    return formats;
}

// フォーマット一覧取得（管理用・非アクティブ含む）
export async function getAllJobDescriptionFormats(): Promise<{
    id: number;
    label: string;
    content: string;
    sort_order: number;
    is_active: boolean;
}[]> {
    const formats = await prisma.jobDescriptionFormat.findMany({
        orderBy: { sort_order: 'asc' },
    });
    return formats;
}

// フォーマット作成
export async function createJobDescriptionFormat(data: {
    label: string;
    content: string;
    sort_order?: number;
}): Promise<{ success: boolean; error?: string }> {
    try {
        // sort_orderが指定されていない場合、最大値+1を設定
        const maxOrder = await prisma.jobDescriptionFormat.aggregate({
            _max: { sort_order: true },
        });
        const newOrder = data.sort_order ?? ((maxOrder._max.sort_order ?? 0) + 1);

        await prisma.jobDescriptionFormat.create({
            data: {
                label: data.label,
                content: data.content,
                sort_order: newOrder,
            },
        });
        revalidatePath('/system-admin/content/templates');
        return { success: true };
    } catch (error) {
        console.error('Failed to create format:', error);
        return { success: false, error: 'フォーマットの作成に失敗しました' };
    }
}

// フォーマット更新
export async function updateJobDescriptionFormat(
    id: number,
    data: {
        label?: string;
        content?: string;
        sort_order?: number;
        is_active?: boolean;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.jobDescriptionFormat.update({
            where: { id },
            data,
        });
        revalidatePath('/system-admin/content/templates');
        return { success: true };
    } catch (error) {
        console.error('Failed to update format:', error);
        return { success: false, error: 'フォーマットの更新に失敗しました' };
    }
}

// フォーマット削除（論理削除）
export async function deleteJobDescriptionFormat(
    id: number
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.jobDescriptionFormat.update({
            where: { id },
            data: { is_active: false },
        });
        revalidatePath('/system-admin/content/templates');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete format:', error);
        return { success: false, error: 'フォーマットの削除に失敗しました' };
    }
}

// 並び順一括更新
export async function updateJobDescriptionFormatOrder(
    orders: { id: number; sort_order: number }[]
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction(
            orders.map(({ id, sort_order }) =>
                prisma.jobDescriptionFormat.update({
                    where: { id },
                    data: { sort_order },
                })
            )
        );
        revalidatePath('/system-admin/content/templates');
        return { success: true };
    } catch (error) {
        console.error('Failed to update order:', error);
        return { success: false, error: '並び順の更新に失敗しました' };
    }
}

// ========== FAQ カテゴリ ==========

export async function getFaqCategories(targetType: 'WORKER' | 'FACILITY') {
    const categories = await prisma.faqCategory.findMany({
        where: { target_type: targetType },
        include: {
            faqs: {
                where: { is_published: true },
                orderBy: { sort_order: 'asc' },
            },
        },
        orderBy: { sort_order: 'asc' },
    });

    return categories;
}

export async function getFaqCategoriesForAdmin(targetType: 'WORKER' | 'FACILITY') {
    const categories = await prisma.faqCategory.findMany({
        where: { target_type: targetType },
        include: {
            faqs: {
                orderBy: { sort_order: 'asc' },
            },
        },
        orderBy: { sort_order: 'asc' },
    });

    return categories;
}

export async function createFaqCategory(data: {
    targetType: 'WORKER' | 'FACILITY';
    name: string;
}) {
    // 最大のsort_orderを取得
    const maxOrder = await prisma.faqCategory.aggregate({
        where: { target_type: data.targetType },
        _max: { sort_order: true },
    });

    const category = await prisma.faqCategory.create({
        data: {
            target_type: data.targetType,
            name: data.name,
            sort_order: (maxOrder._max.sort_order ?? 0) + 1,
        },
    });

    revalidatePath('/system-admin/content/faq');
    return category;
}

export async function updateFaqCategory(id: number, data: { name: string }) {
    const category = await prisma.faqCategory.update({
        where: { id },
        data: { name: data.name },
    });

    revalidatePath('/system-admin/content/faq');
    return category;
}

export async function deleteFaqCategory(id: number) {
    await prisma.faqCategory.delete({
        where: { id },
    });

    revalidatePath('/system-admin/content/faq');
}

export async function updateFaqCategoryOrder(updates: { id: number; sortOrder: number }[]) {
    await prisma.$transaction(
        updates.map((update) =>
            prisma.faqCategory.update({
                where: { id: update.id },
                data: { sort_order: update.sortOrder },
            })
        )
    );

    revalidatePath('/system-admin/content/faq');
}

// ========== FAQ 項目 ==========

export async function createFaq(data: {
    categoryId: number;
    question: string;
    answer: string;
}) {
    // 最大のsort_orderを取得
    const maxOrder = await prisma.faq.aggregate({
        where: { category_id: data.categoryId },
        _max: { sort_order: true },
    });

    const faq = await prisma.faq.create({
        data: {
            category_id: data.categoryId,
            question: data.question,
            answer: data.answer,
            sort_order: (maxOrder._max.sort_order ?? 0) + 1,
        },
    });

    revalidatePath('/system-admin/content/faq');
    return faq;
}

export async function updateFaq(id: number, data: {
    question?: string;
    answer?: string;
    isPublished?: boolean;
}) {
    const faq = await prisma.faq.update({
        where: { id },
        data: {
            question: data.question,
            answer: data.answer,
            is_published: data.isPublished,
        },
    });

    revalidatePath('/system-admin/content/faq');
    return faq;
}

export async function deleteFaq(id: number) {
    await prisma.faq.delete({
        where: { id },
    });

    revalidatePath('/system-admin/content/faq');
}

export async function updateFaqOrder(updates: { id: number; sortOrder: number }[]) {
    await prisma.$transaction(
        updates.map((update) =>
            prisma.faq.update({
                where: { id: update.id },
                data: { sort_order: update.sortOrder },
            })
        )
    );

    revalidatePath('/system-admin/content/faq');
}

export async function updateSingleFaqOrder(id: number, sortOrder: number) {
    await prisma.faq.update({
        where: { id },
        data: { sort_order: sortOrder },
    });

    revalidatePath('/system-admin/content/faq');
}

// ========== 利用規約・プライバシーポリシー ==========

export async function getLegalDocument(docType: 'TERMS' | 'PRIVACY', targetType: 'WORKER' | 'FACILITY') {
    const doc = await prisma.legalDocument.findFirst({
        where: {
            doc_type: docType,
            target_type: targetType,
            is_current: true,
        },
    });

    return doc;
}

export async function getLegalDocumentVersions(docType: 'TERMS' | 'PRIVACY', targetType: 'WORKER' | 'FACILITY') {
    const docs = await prisma.legalDocument.findMany({
        where: {
            doc_type: docType,
            target_type: targetType,
        },
        orderBy: { version: 'desc' },
    });

    return docs;
}

export async function createLegalDocument(data: {
    docType: 'TERMS' | 'PRIVACY';
    targetType: 'WORKER' | 'FACILITY';
    content: string;
    createdBy: number;
}) {
    // 既存のcurrentをfalseに
    await prisma.legalDocument.updateMany({
        where: {
            doc_type: data.docType,
            target_type: data.targetType,
            is_current: true,
        },
        data: { is_current: false },
    });

    // 最新バージョンを取得
    const latestVersion = await prisma.legalDocument.aggregate({
        where: {
            doc_type: data.docType,
            target_type: data.targetType,
        },
        _max: { version: true },
    });

    const doc = await prisma.legalDocument.create({
        data: {
            doc_type: data.docType,
            target_type: data.targetType,
            content: data.content,
            version: (latestVersion._max.version ?? 0) + 1,
            is_current: true,
            published_at: new Date(),
            created_by: data.createdBy,
        },
    });

    revalidatePath('/system-admin/content/legal');
    return doc;
}

export async function revertToLegalDocumentVersion(id: number) {
    // 対象のドキュメントを取得
    const targetDoc = await prisma.legalDocument.findUnique({
        where: { id },
    });

    if (!targetDoc) {
        throw new Error('ドキュメントが見つかりません');
    }

    // 同じタイプの既存currentをfalseに
    await prisma.legalDocument.updateMany({
        where: {
            doc_type: targetDoc.doc_type,
            target_type: targetDoc.target_type,
            is_current: true,
        },
        data: { is_current: false },
    });

    // 指定されたバージョンをcurrentに
    await prisma.legalDocument.update({
        where: { id },
        data: { is_current: true },
    });

    revalidatePath('/system-admin/content/legal');
}

// ========== ご利用ガイド ==========

export async function getCurrentUserGuide(targetType: 'FACILITY') {
    const guide = await prisma.userGuide.findFirst({
        where: { target_type: targetType },
        orderBy: { created_at: 'desc' },
    });

    return guide;
}

export async function getUserGuideHistory(targetType: 'FACILITY') {
    const guides = await prisma.userGuide.findMany({
        where: { target_type: targetType },
        orderBy: { created_at: 'desc' },
    });

    return guides;
}

export async function createUserGuide(data: {
    targetType: 'FACILITY';
    filePath: string;
    fileName: string;
    fileSize: number;
    uploadedBy: number;
}) {
    const guide = await prisma.userGuide.create({
        data: {
            target_type: data.targetType,
            file_path: data.filePath,
            file_name: data.fileName,
            file_size: data.fileSize,
            uploaded_by: data.uploadedBy,
        },
    });

    revalidatePath('/system-admin/content/user-guide');
    return guide;
}

export async function deleteUserGuide(id: number) {
    await prisma.userGuide.delete({
        where: { id },
    });

    revalidatePath('/system-admin/content/user-guide');
}
// ========== 解雇事由連携 ==========

/**
 * 労働条件通知書テンプレートから解雇事由セクションを抽出
 */
export async function getDismissalReasonsFromLaborTemplate(): Promise<string> {
    const template = await prisma.laborDocumentTemplate.findFirst({
        orderBy: { updated_at: 'desc' },
    });

    if (!template?.template_content) {
        // フォールバック: デフォルトの内容を返す
        return `当社では、以下に該当する場合、やむを得ず契約解除となる可能性がございます。

【即時契約解除となる事由】
・正当な理由なく無断欠勤が続いた場合
・業務上の重大な過失または故意による事故を起こした場合
・利用者様や他の職員に対する暴力行為、ハラスメント行為があった場合
・業務上知り得た秘密を漏洩した場合
・犯罪行為により逮捕または起訴された場合

【警告後、改善が見られない場合の契約解除事由】
・遅刻・早退が頻繁にある場合（月3回以上）
・業務指示に従わず、改善が見られない場合
・勤務態度が著しく不良で、指導後も改善されない場合
・健康上の理由により業務遂行が困難と判断された場合

【その他】
・契約期間満了時に更新しない場合がございます
・上記に該当する場合でも、状況により協議の上、判断いたします
・解雇の際は、労働基準法に基づき適切な手続きを行います

※詳細は雇用契約書をご確認ください。`;
    }

    const content = template.template_content;

    // 「■ 解雇の事由」または「■解雇の事由」セクションを探す
    const sectionPatterns = [
        /■\s*解雇の事由[^\n]*\n([\s\S]*?)(?=■|$)/,
        /■\s*解雇[^\n]*\n([\s\S]*?)(?=■|$)/,
    ];

    for (const pattern of sectionPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            // セクションの内容を整形して返す
            return match[1].trim();
        }
    }

    // セクションが見つからない場合はフォールバック
    return `当社では、以下に該当する場合、やむを得ず契約解除となる可能性がございます。

【即時契約解除となる事由】
・正当な理由なく無断欠勤が続いた場合
・業務上の重大な過失または故意による事故を起こした場合

※詳細は雇用契約書をご確認ください。`;
}

// ========== 資格略称管理 ==========

import { DEFAULT_QUALIFICATION_ABBREVIATIONS } from '@/constants/qualifications';

const QUALIFICATION_ABBREVIATIONS_KEY = 'qualification_abbreviations';

/**
 * 資格略称マッピングを取得
 * DBに保存されていればそれを、なければデフォルト値を返す
 */
export async function getQualificationAbbreviations(): Promise<Record<string, string>> {
    const template = await prisma.systemTemplate.findUnique({
        where: { key: QUALIFICATION_ABBREVIATIONS_KEY }
    });

    if (template?.value) {
        try {
            return JSON.parse(template.value);
        } catch {
            // パースエラーの場合はデフォルトを返す
            return { ...DEFAULT_QUALIFICATION_ABBREVIATIONS };
        }
    }

    return { ...DEFAULT_QUALIFICATION_ABBREVIATIONS };
}

/**
 * 資格略称マッピングを更新
 */
export async function updateQualificationAbbreviations(
    abbreviations: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.systemTemplate.upsert({
            where: { key: QUALIFICATION_ABBREVIATIONS_KEY },
            update: { value: JSON.stringify(abbreviations) },
            create: { key: QUALIFICATION_ABBREVIATIONS_KEY, value: JSON.stringify(abbreviations) }
        });

        revalidatePath('/system-admin/content/templates');
        revalidatePath('/admin/applications');
        return { success: true };
    } catch (error) {
        console.error('Failed to update qualification abbreviations:', error);
        return { success: false, error: '資格略称の更新に失敗しました' };
    }
}

/**
 * 資格略称をデフォルトにリセット
 */
export async function resetQualificationAbbreviations(): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.systemTemplate.upsert({
            where: { key: QUALIFICATION_ABBREVIATIONS_KEY },
            update: { value: JSON.stringify(DEFAULT_QUALIFICATION_ABBREVIATIONS) },
            create: { key: QUALIFICATION_ABBREVIATIONS_KEY, value: JSON.stringify(DEFAULT_QUALIFICATION_ABBREVIATIONS) }
        });

        revalidatePath('/system-admin/content/templates');
        revalidatePath('/admin/applications');
        return { success: true };
    } catch (error) {
        console.error('Failed to reset qualification abbreviations:', error);
        return { success: false, error: '資格略称のリセットに失敗しました' };
    }
}
