'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';

import { useAuth } from '@/contexts/AuthContext';
import { Upload, X } from 'lucide-react';
import { TemplatePreviewModal } from '@/components/admin/TemplatePreviewModal';
import { calculateDailyWage, calculateWorkingHours } from '@/utils/salary';
import { validateImageFiles, validateAttachmentFiles } from '@/utils/fileValidation';
import toast from 'react-hot-toast';
import { directUploadMultiple } from '@/utils/directUpload';
import { getFacilityById, createJobTemplate, updateJobTemplate } from '@/src/lib/actions';
import { getJobDescriptionFormats, getDismissalReasonsFromLaborTemplate } from '@/src/lib/content-actions';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import {
    JOB_TYPES,
    WORK_CONTENT_OPTIONS,
    ICON_OPTIONS,
    BREAK_TIME_OPTIONS,
    TRANSPORTATION_FEE_OPTIONS,
    RECRUITMENT_START_DAY_OPTIONS,
    RECRUITMENT_END_DAY_OPTIONS,
    HOUR_OPTIONS,
    END_HOUR_OPTIONS,
    MINUTE_OPTIONS,
} from '@/constants';
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';

// 初期データの型定義
export interface TemplateInitialData {
    id?: number;
    name: string;
    title: string;
    jobType: string;
    recruitmentCount: number;
    startTime: string;
    endTime: string;
    breakTime: number;
    recruitmentStartDay: number;
    recruitmentStartTime: string;
    recruitmentEndDay: number;
    recruitmentEndTime: string;
    hourlyWage: number;
    transportationFee: number;
    workContent: string[];
    genderRequirement: string;
    jobDescription: string;
    qualifications: string[];
    skills: string[];
    dresscode: string[];
    belongings: string[];
    icons: string[];
    notes: string;
    dismissalReasons: string;
    // 既存データ（編集時のみ）
    existingImages?: string[];
    existingDresscodeImages?: string[];
    existingAttachments?: string[];
}

interface JobTemplateFormProps {
    mode: 'create' | 'edit';
    templateId?: number;
    initialData?: TemplateInitialData;
}

export default function JobTemplateForm({ mode, templateId, initialData }: JobTemplateFormProps) {
    const router = useRouter();
    const { mutate: globalMutate } = useSWRConfig();

    const { showDebugError } = useDebugError();
    const { admin, isAdmin } = useAuth();
    const [facilityName, setFacilityName] = useState<string>('');
    const [facilityData, setFacilityData] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [jobDescriptionFormats, setJobDescriptionFormats] = useState<{ id: number; label: string; content: string }[]>([]);
    const [showErrors, setShowErrors] = useState(false);

    // デフォルト値
    const defaultFormData = {
        name: '',
        title: '',
        jobType: '通常業務',
        recruitmentCount: 1,
        images: [] as File[],
        existingImages: [] as string[],
        startTime: '06:00',
        endTime: '15:00',
        breakTime: 0,
        recruitmentStartDay: 0,
        recruitmentStartTime: '',
        recruitmentEndDay: 0,
        recruitmentEndTime: '05:00',
        hourlyWage: 1500,
        transportationFee: 0,
        workContent: [] as string[],
        genderRequirement: '',
        jobDescription: '',
        qualifications: [] as string[],
        skills: [] as string[],
        dresscode: [] as string[],
        dresscodeImages: [] as File[],
        existingDresscodeImages: [] as string[],
        belongings: [] as string[],
        icons: [] as string[],
        notes: '',
        attachments: [] as File[],
        existingAttachments: [] as string[],
        dismissalReasons: '',
    };

    const [formData, setFormData] = useState(defaultFormData);

    const [skillInput, setSkillInput] = useState('');
    const [dresscodeInput, setDresscodeInput] = useState('');
    const [belongingInput, setBelongingInput] = useState('');

    useEffect(() => {
        if (!isAdmin || !admin) {
            router.push('/admin/login');
        }
    }, [isAdmin, admin, router]);

    // 施設名とフォーマットを取得
    useEffect(() => {
        const loadData = async () => {
            try {
                const [formats, defaultDismissalReasons] = await Promise.all([
                    getJobDescriptionFormats(),
                    getDismissalReasonsFromLaborTemplate()
                ]);

                setJobDescriptionFormats(formats);

                // 編集モードでinitialDataがある場合
                if (mode === 'edit' && initialData) {
                    setFormData(prev => ({
                        ...prev,
                        ...initialData,
                        images: [],
                        dresscodeImages: [],
                        attachments: [],
                        existingImages: initialData.existingImages || [],
                        existingDresscodeImages: initialData.existingDresscodeImages || [],
                        existingAttachments: initialData.existingAttachments || [],
                        dismissalReasons: initialData.dismissalReasons || defaultDismissalReasons,
                    }));
                } else {
                    // 新規作成モード
                    setFormData(prev => ({
                        ...prev,
                        dismissalReasons: defaultDismissalReasons
                    }));
                }
            } catch (error) {
                const debugInfo = extractDebugInfo(error);
                showDebugError({
                    type: 'fetch',
                    operation: '求人テンプレート作成用データ取得',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack
                });
                console.error('Failed to fetch data:', error);
            }

            if (admin?.facilityId) {
                const facility = await getFacilityById(admin.facilityId);
                if (facility) {
                    setFacilityName(facility.facility_name);
                    setFacilityData(facility);
                }
            }
        };
        loadData();
    }, [admin?.facilityId, mode, initialData]);

    if (!isAdmin || !admin) {
        return null;
    }

    // ============ ハンドラー関数群 ============

    const handleInputChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    const toggleArrayItem = (field: string, item: string) => {
        const currentArray = formData[field as keyof typeof formData] as string[];
        if (currentArray.includes(item)) {
            handleInputChange(field, currentArray.filter(i => i !== item));
        } else {
            handleInputChange(field, [...currentArray, item]);
        }
    };

    const addToArray = (field: string, value: string, setValue: (v: string) => void) => {
        if (value.trim() && (formData[field as keyof typeof formData] as string[]).length < 5) {
            handleInputChange(field, [...(formData[field as keyof typeof formData] as string[]), value.trim()]);
            setValue('');
        }
    };

    const removeFromArray = (field: string, index: number) => {
        handleInputChange(field, (formData[field as keyof typeof formData] as string[]).filter((_, i) => i !== index));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const result = validateImageFiles(files);
        result.errors.forEach(error => toast.error(error));
        if (result.validFiles.length === 0) return;

        const totalImages = formData.existingImages.length + formData.images.length + result.validFiles.length;
        if (totalImages <= 3) {
            handleInputChange('images', [...formData.images, ...result.validFiles]);
        } else {
            toast.error('画像は最大3枚までアップロードできます');
        }
    };

    const removeImage = (index: number) => {
        handleInputChange('images', formData.images.filter((_, i) => i !== index));
    };

    const removeExistingImage = (index: number) => {
        handleInputChange('existingImages', formData.existingImages.filter((_, i) => i !== index));
    };

    const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const result = validateAttachmentFiles(files);
        result.errors.forEach(error => toast.error(error));
        if (result.validFiles.length === 0) return;

        const totalAttachments = formData.existingAttachments.length + formData.attachments.length + result.validFiles.length;
        if (totalAttachments <= 3) {
            handleInputChange('attachments', [...formData.attachments, ...result.validFiles]);
        } else {
            toast.error('添付ファイルは最大3つまでアップロードできます');
        }
    };

    const removeAttachment = (index: number) => {
        handleInputChange('attachments', formData.attachments.filter((_, i) => i !== index));
    };

    const removeExistingAttachment = (index: number) => {
        handleInputChange('existingAttachments', formData.existingAttachments.filter((_, i) => i !== index));
    };

    const handleDresscodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const result = validateImageFiles(files);
        result.errors.forEach(error => toast.error(error));
        if (result.validFiles.length === 0) return;

        const totalDresscodeImages = formData.existingDresscodeImages.length + formData.dresscodeImages.length + result.validFiles.length;
        if (totalDresscodeImages <= 3) {
            handleInputChange('dresscodeImages', [...formData.dresscodeImages, ...result.validFiles]);
        } else {
            toast.error('服装サンプル画像は最大3枚までアップロードできます');
        }
    };

    const removeDresscodeImage = (index: number) => {
        handleInputChange('dresscodeImages', formData.dresscodeImages.filter((_, i) => i !== index));
    };

    const removeExistingDresscodeImage = (index: number) => {
        handleInputChange('existingDresscodeImages', formData.existingDresscodeImages.filter((_, i) => i !== index));
    };

    const dailyWage = calculateDailyWage(
        formData.startTime,
        formData.endTime,
        formData.breakTime,
        formData.hourlyWage,
        formData.transportationFee
    );

    // 実働時間を計算
    const workingHours = calculateWorkingHours(
        formData.startTime,
        formData.endTime,
        formData.breakTime
    );

    // 実働時間を「X時間Y分」形式でフォーマット
    const formatWorkingHours = (hours: number): string => {
        if (hours <= 0) return '0時間';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        if (m === 0) return `${h}時間`;
        return `${h}時間${m}分`;
    };

    const requiresGenderSpecification = formData.workContent.includes('入浴介助(大浴場)') ||
        formData.workContent.includes('入浴介助(全般)') ||
        formData.workContent.includes('入浴介助(機械浴)') ||
        formData.workContent.includes('入浴介助(個浴)') ||
        formData.workContent.includes('排泄介助');

    const handleSave = async () => {
        if (saving) return;
        setShowErrors(true);

        // バリデーション
        const errors: string[] = [];
        if (!formData.name) errors.push('テンプレート名');
        if (!formData.title) errors.push('求人タイトル');
        if (!formData.startTime || !formData.endTime) errors.push('勤務時間');
        if (formData.hourlyWage <= 0) errors.push('時給');
        if (formData.workContent.length === 0) errors.push('仕事内容');
        if (formData.qualifications.length === 0) errors.push('資格条件');
        if (formData.icons.length === 0) errors.push('アイコン');

        // 勤務時間（拘束時間）に応じた休憩時間チェック（労働基準法準拠）
        if (formData.startTime && formData.endTime) {
            const parseTimeForValidation = (time: string) => {
                const isNextDay = time.startsWith('翌');
                const timePart = isNextDay ? time.slice(1) : time;
                const [hour, min] = timePart.split(':').map(Number);
                return { hour, min, isNextDay };
            };

            const start = parseTimeForValidation(formData.startTime);
            const end = parseTimeForValidation(formData.endTime);

            const startMinutes = start.hour * 60 + start.min;
            let endMinutes = end.hour * 60 + end.min;
            if (end.isNextDay) {
                endMinutes += 24 * 60;
            }

            let grossMinutes = endMinutes - startMinutes;
            if (grossMinutes < 0) grossMinutes += 24 * 60;

            // 8時間（480分）を超える勤務 → 60分以上の休憩が必要
            if (grossMinutes > 480 && formData.breakTime < 60) {
                toast.error('8時間を超える勤務の場合、休憩時間は60分以上必要です');
                return;
            }
            // 6時間（360分）を超える勤務 → 45分以上の休憩が必要
            else if (grossMinutes > 360 && formData.breakTime < 45) {
                toast.error('6時間を超える勤務の場合、休憩時間は45分以上必要です');
                return;
            }
        }

        if (!admin?.facilityId) {
            toast.error('施設情報が取得できません');
            return;
        }

        if (errors.length > 0) {
            toast.error(`以下の項目を入力してください: ${errors.join('、')}`);
            const firstErrorElement = document.querySelector('.border-red-500');
            if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        setSaving(true);
        try {
            // TOP画像をアップロード（署名付きURL方式）
            let newImageUrls: string[] = [];
            if (formData.images.length > 0) {
                const adminSession = localStorage.getItem('admin_session') || '';
                const results = await directUploadMultiple(formData.images, {
                    uploadType: 'job',
                    adminSession,
                });

                const failedUploads = results.filter(r => !r.success);
                if (failedUploads.length > 0) {
                    showDebugError({
                        type: 'upload',
                        operation: '求人テンプレート画像アップロード',
                        message: failedUploads[0].error || 'TOP画像のアップロードに失敗しました',
                        context: { facilityId: admin.facilityId }
                    });
                    throw new Error(failedUploads[0].error || 'TOP画像のアップロードに失敗しました');
                }

                newImageUrls = results
                    .filter(r => r.success && r.url)
                    .map(r => r.url!);
            }

            // 服装サンプル画像をアップロード（署名付きURL方式）
            let newDresscodeImageUrls: string[] = [];
            if (formData.dresscodeImages.length > 0) {
                const adminSession = localStorage.getItem('admin_session') || '';
                const results = await directUploadMultiple(formData.dresscodeImages, {
                    uploadType: 'job',
                    adminSession,
                });

                const failedUploads = results.filter(r => !r.success);
                if (failedUploads.length > 0) {
                    showDebugError({
                        type: 'upload',
                        operation: '求人テンプレート服装画像アップロード',
                        message: failedUploads[0].error || '服装サンプル画像のアップロードに失敗しました',
                        context: { facilityId: admin.facilityId }
                    });
                    throw new Error(failedUploads[0].error || '服装サンプル画像のアップロードに失敗しました');
                }

                newDresscodeImageUrls = results
                    .filter(r => r.success && r.url)
                    .map(r => r.url!);
            }

            // 添付ファイルをアップロード（署名付きURL方式）
            let newAttachmentUrls: string[] = [];
            if (formData.attachments.length > 0) {
                const adminSession = localStorage.getItem('admin_session') || '';
                const results = await directUploadMultiple(formData.attachments, {
                    uploadType: 'job',
                    adminSession,
                });

                const failedUploads = results.filter(r => !r.success);
                if (failedUploads.length > 0) {
                    showDebugError({
                        type: 'upload',
                        operation: '求人テンプレート添付ファイルアップロード',
                        message: failedUploads[0].error || '添付ファイルのアップロードに失敗しました',
                        context: { facilityId: admin.facilityId }
                    });
                    throw new Error(failedUploads[0].error || '添付ファイルのアップロードに失敗しました');
                }

                newAttachmentUrls = results
                    .filter(r => r.success && r.url)
                    .map(r => r.url!);
            }

            // 既存URL + 新規URLを結合
            const finalImages = [...formData.existingImages, ...newImageUrls];
            const finalDresscodeImages = [...formData.existingDresscodeImages, ...newDresscodeImageUrls];
            const finalAttachments = [...formData.existingAttachments, ...newAttachmentUrls];

            const templateData = {
                name: formData.name,
                title: formData.title,
                startTime: formData.startTime,
                endTime: formData.endTime,
                breakTime: formData.breakTime,
                hourlyWage: formData.hourlyWage,
                transportationFee: formData.transportationFee,
                recruitmentCount: formData.recruitmentCount,
                qualifications: formData.qualifications,
                workContent: formData.workContent,
                description: formData.jobDescription,
                skills: formData.skills,
                dresscode: formData.dresscode,
                belongings: formData.belongings,
                icons: formData.icons,
                notes: formData.notes,
                images: finalImages,
                dresscodeImages: finalDresscodeImages,
                attachments: finalAttachments,
            };

            let result;
            if (mode === 'edit' && templateId) {
                result = await updateJobTemplate(templateId, admin.facilityId, templateData);
            } else {
                result = await createJobTemplate(admin.facilityId, templateData);
            }

            if (result.success) {
                toast.success(mode === 'edit' ? 'テンプレートを更新しました' : 'テンプレートを保存しました');
                // SWRキャッシュをクリアして一覧を更新
                globalMutate((key) => typeof key === 'string' && key.includes('/api/admin/jobs'));
                router.push('/admin/jobs/templates');
            } else {
                showDebugError({
                    type: mode === 'edit' ? 'update' : 'save',
                    operation: mode === 'edit' ? 'テンプレート更新' : 'テンプレート保存',
                    message: result.error || '保存に失敗しました',
                    context: { facilityId: admin.facilityId, templateId }
                });
                toast.error(result.error || 'テンプレートの保存に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: mode === 'edit' ? 'update' : 'save',
                operation: mode === 'edit' ? 'テンプレート更新(例外)' : 'テンプレート保存(例外)',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId: admin.facilityId, templateId }
            });
            toast.error('テンプレートの保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900">
                        {mode === 'edit' ? 'テンプレート編集' : 'テンプレート作成'}
                    </h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const newImageUrls = formData.images.map(file => URL.createObjectURL(file));
                                setPreviewImages([...formData.existingImages, ...newImageUrls]);
                                setShowPreview(true);
                            }}
                            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                        >
                            プレビュー
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                        >
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>
            </div>

            {/* フォーム本体 */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* ===== 基本セクション ===== */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">基本</h2>
                        <div className="space-y-4">
                            {/* テンプレート名 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    テンプレート名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${showErrors && !formData.name ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    placeholder="例:デイサービス日勤・介護職員"
                                />
                                {showErrors && !formData.name && (
                                    <p className="text-red-500 text-xs mt-1">テンプレート名を入力してください</p>
                                )}
                            </div>

                            {/* 求人タイトル */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    求人タイトル <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${showErrors && !formData.title ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    placeholder="例:デイサービス・介護スタッフ募集（日勤）"
                                />
                                {showErrors && !formData.title && (
                                    <p className="text-red-500 text-xs mt-1">求人タイトルを入力してください</p>
                                )}
                            </div>

                            {/* 施設・求人タイプ・募集人数 */}
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">施設</label>
                                    <input
                                        type="text"
                                        value={facilityName || '読み込み中...'}
                                        readOnly
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div className="col-span-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
                                    <select
                                        value={formData.jobType}
                                        onChange={(e) => handleInputChange('jobType', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        {JOB_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        募集人数 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.recruitmentCount}
                                        onChange={(e) => handleInputChange('recruitmentCount', Number(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                                            <option key={num} value={num}>{num}人</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* TOP画像 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    TOP画像登録（3枚まで） <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-500 mb-2">推奨画像サイズ: 1200×800px（比率 3:2）</p>
                                <p className="text-xs text-gray-500 mb-3">登録できるファイルサイズは20MBまでです</p>
                                <div className="space-y-2">
                                    {/* アップロードエリア */}
                                    {(formData.existingImages.length + formData.images.length) < 3 && (
                                        <label
                                            className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors"
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                                const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
                                                const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
                                                if (files.length !== validFiles.length) {
                                                    toast.error('20MBを超えるファイルは登録できません');
                                                    return;
                                                }
                                                const totalImages = formData.existingImages.length + formData.images.length + validFiles.length;
                                                if (totalImages <= 3) {
                                                    handleInputChange('images', [...formData.images, ...validFiles]);
                                                } else {
                                                    toast.error('画像は最大3枚までアップロードできます');
                                                }
                                            }}
                                        >
                                            <div className="text-center">
                                                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                                <span className="text-sm text-gray-500">画像を選択 または ドラッグ&ドロップ</span>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                        </label>
                                    )}

                                    {/* 既存画像の表示 */}
                                    {formData.existingImages.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-xs text-gray-500 mb-2">登録済み画像:</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {formData.existingImages.map((url, index) => (
                                                    <div key={`existing-${index}`} className="relative">
                                                        <img
                                                            src={url}
                                                            alt={`登録済み画像 ${index + 1}`}
                                                            className="w-full h-24 object-cover rounded border border-gray-300"
                                                        />
                                                        <button
                                                            onClick={() => removeExistingImage(index)}
                                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 新規アップロード画像 */}
                                    {formData.images.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2">
                                            {formData.images.map((file, index) => (
                                                <div key={index} className="relative">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt={`Upload ${index + 1}`}
                                                        className="w-full h-24 object-cover rounded"
                                                    />
                                                    <button
                                                        onClick={() => removeImage(index)}
                                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== 勤務時間 ===== */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">勤務時間</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        開始時刻 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-1">
                                        <select
                                            value={formData.startTime.split(':')[0] || '06'}
                                            onChange={(e) => {
                                                const minute = formData.startTime.split(':')[1] || '00';
                                                handleInputChange('startTime', `${e.target.value}:${minute}`);
                                            }}
                                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        >
                                            {HOUR_OPTIONS.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={formData.startTime.split(':')[1] || '00'}
                                            onChange={(e) => {
                                                const hour = formData.startTime.split(':')[0] || '06';
                                                handleInputChange('startTime', `${hour}:${e.target.value}`);
                                            }}
                                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        >
                                            {MINUTE_OPTIONS.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        終了時刻 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-1">
                                        <select
                                            value={(() => {
                                                // 翌日の場合: "翌15:00" → "翌15", 当日の場合: "15:00" → "15"
                                                const isNextDay = formData.endTime.startsWith('翌');
                                                const timePart = isNextDay ? formData.endTime.slice(1) : formData.endTime;
                                                const hour = timePart.split(':')[0] || '15';
                                                return isNextDay ? `翌${hour}` : hour;
                                            })()}
                                            onChange={(e) => {
                                                const isNextDay = formData.endTime.startsWith('翌');
                                                const timePart = isNextDay ? formData.endTime.slice(1) : formData.endTime;
                                                const minute = timePart.split(':')[1] || '00';
                                                const newIsNextDay = e.target.value.startsWith('翌');
                                                const newHour = newIsNextDay ? e.target.value.slice(1) : e.target.value;
                                                handleInputChange('endTime', newIsNextDay ? `翌${newHour}:${minute}` : `${newHour}:${minute}`);
                                            }}
                                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        >
                                            {END_HOUR_OPTIONS.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={(() => {
                                                const isNextDay = formData.endTime.startsWith('翌');
                                                const timePart = isNextDay ? formData.endTime.slice(1) : formData.endTime;
                                                return timePart.split(':')[1] || '00';
                                            })()}
                                            onChange={(e) => {
                                                const isNextDay = formData.endTime.startsWith('翌');
                                                const timePart = isNextDay ? formData.endTime.slice(1) : formData.endTime;
                                                const hour = timePart.split(':')[0] || '15';
                                                handleInputChange('endTime', isNextDay ? `翌${hour}:${e.target.value}` : `${hour}:${e.target.value}`);
                                            }}
                                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        >
                                            {MINUTE_OPTIONS.map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        休憩時間 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.breakTime}
                                        onChange={(e) => handleInputChange('breakTime', Number(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        {BREAK_TIME_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* 実働時間表示 */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">実働時間</span>
                                    <span className="text-lg font-bold text-blue-600" data-testid="working-hours-display">
                                        {formatWorkingHours(workingHours)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    ※ 開始時刻・終了時刻・休憩時間から自動計算されます
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        募集開始日 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.recruitmentStartDay}
                                        onChange={(e) => handleInputChange('recruitmentStartDay', Number(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        {RECRUITMENT_START_DAY_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {formData.recruitmentStartDay !== 0 && formData.recruitmentStartDay !== -1 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            募集開始時間 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.recruitmentStartTime}
                                            onChange={(e) => handleInputChange('recruitmentStartTime', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        募集終了日 <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.recruitmentEndDay}
                                        onChange={(e) => handleInputChange('recruitmentEndDay', Number(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        {RECRUITMENT_END_DAY_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {formData.recruitmentEndDay !== 0 && formData.recruitmentEndDay !== -1 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            募集終了時間 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.recruitmentEndTime}
                                            onChange={(e) => handleInputChange('recruitmentEndTime', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ===== 給与 ===== */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">給与</h2>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    時給（円） <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="50"
                                    min="0"
                                    value={formData.hourlyWage === 0 ? '' : formData.hourlyWage}
                                    onChange={(e) => handleInputChange('hourlyWage', Number(e.target.value))}
                                    className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${showErrors && formData.hourlyWage <= 0 ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    placeholder="例: 1200"
                                />
                                {formData.hourlyWage > 0 && (
                                    <p className="text-blue-600 text-xs mt-1">¥{formData.hourlyWage.toLocaleString()}</p>
                                )}
                                {showErrors && formData.hourlyWage <= 0 && (
                                    <p className="text-red-500 text-xs mt-1">時給を入力してください</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    交通費（円） <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.transportationFee}
                                    onChange={(e) => handleInputChange('transportationFee', Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    {TRANSPORTATION_FEE_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    日給（総支払）
                                </label>
                                <input
                                    type="number"
                                    value={dailyWage}
                                    readOnly
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ===== 業務設定 ===== */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">業務設定</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    仕事内容（複数選択可） <span className="text-red-500">*</span>
                                </label>
                                <div className={`grid grid-cols-4 gap-2 p-2 border rounded ${showErrors && formData.workContent.length === 0 ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                    {WORK_CONTENT_OPTIONS.map(option => (
                                        <label key={option} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.workContent.includes(option)}
                                                onChange={() => toggleArrayItem('workContent', option)}
                                                className="rounded text-blue-600"
                                            />
                                            <span className="text-sm">{option}</span>
                                        </label>
                                    ))}
                                </div>
                                {showErrors && formData.workContent.length === 0 && (
                                    <p className="text-red-500 text-xs mt-1">仕事内容を選択してください</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    性別指定 <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-500 mb-2">入浴介助または排泄介助を選択した場合のみ指定が必要です</p>
                                <select
                                    value={formData.genderRequirement}
                                    onChange={(e) => handleInputChange('genderRequirement', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    disabled={!requiresGenderSpecification}
                                >
                                    <option value="">指定なし</option>
                                    <option value="male">男性</option>
                                    <option value="female">女性</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    仕事詳細 <span className="text-red-500">*</span>
                                </label>
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            const format = jobDescriptionFormats.find(f => f.label === e.target.value);
                                            if (format) {
                                                handleInputChange('jobDescription', format.content);
                                            }
                                        }
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 mb-2"
                                >
                                    <option value="">フォーマットを選択</option>
                                    {jobDescriptionFormats.map(format => (
                                        <option key={format.id} value={format.label}>{format.label}</option>
                                    ))}
                                </select>
                                <textarea
                                    value={formData.jobDescription}
                                    onChange={(e) => handleInputChange('jobDescription', e.target.value)}
                                    rows={9}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    placeholder="業務の詳細を入力してください"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ===== 条件設定 ===== */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">条件設定</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    資格条件（複数選択可） <span className="text-red-500">*</span>
                                </label>
                                <div className={`border rounded p-4 ${showErrors && formData.qualifications.length === 0 ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                    {QUALIFICATION_GROUPS.map((group) => (
                                        <div key={group.name} className="mb-4">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {group.qualifications.map((qual) => (
                                                    <label key={qual} className="flex items-center gap-2 text-sm cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.qualifications.includes(qual)}
                                                            onChange={() => toggleArrayItem('qualifications', qual)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span>{qual}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="mt-4 pt-4 border-t">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.qualifications.includes('無資格可')}
                                                onChange={() => toggleArrayItem('qualifications', '無資格可')}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="font-medium">無資格可</span>
                                        </label>
                                    </div>
                                </div>
                                {showErrors && formData.qualifications.length === 0 && (
                                    <p className="text-red-500 text-xs mt-1">資格条件を選択してください</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    スキル・経験（5つまで入力可能）
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={skillInput}
                                        onChange={(e) => setSkillInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addToArray('skills', skillInput, setSkillInput)}
                                        disabled={formData.skills.length >= 5}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                                        placeholder="スキルを追加"
                                    />
                                    <button
                                        onClick={() => addToArray('skills', skillInput, setSkillInput)}
                                        disabled={formData.skills.length >= 5}
                                        className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300"
                                    >
                                        追加
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.skills.map((skill, index) => (
                                        <span key={index} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded flex items-center gap-2">
                                            {skill}
                                            <button onClick={() => removeFromArray('skills', index)} className="text-gray-500 hover:text-red-600">×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    服装・身だしなみ（5つまで入力可能）
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={dresscodeInput}
                                        onChange={(e) => setDresscodeInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addToArray('dresscode', dresscodeInput, setDresscodeInput)}
                                        disabled={formData.dresscode.length >= 5}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                                        placeholder="服装・身だしなみを追加"
                                    />
                                    <button
                                        onClick={() => addToArray('dresscode', dresscodeInput, setDresscodeInput)}
                                        disabled={formData.dresscode.length >= 5}
                                        className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300"
                                    >
                                        追加
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.dresscode.map((item, index) => (
                                        <span key={index} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded flex items-center gap-2">
                                            {item}
                                            <button onClick={() => removeFromArray('dresscode', index)} className="text-gray-500 hover:text-red-600">×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    服装サンプル画像（3枚まで）
                                </label>
                                <p className="text-xs text-gray-500 mb-2">推奨画像サイズ: 1200×800px（比率 3:2）</p>
                                <p className="text-xs text-gray-500 mb-3">5MB以下 / JPG, PNG, HEIC, GIF, PDF形式</p>
                                <div className="space-y-2">
                                    {(formData.existingDresscodeImages.length + formData.dresscodeImages.length) < 3 && (
                                        <label
                                            className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors"
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                                const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
                                                const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
                                                if (files.length !== validFiles.length) {
                                                    toast.error('5MBを超えるファイルは登録できません');
                                                    return;
                                                }
                                                const totalImages = formData.existingDresscodeImages.length + formData.dresscodeImages.length + validFiles.length;
                                                if (totalImages <= 3) {
                                                    handleInputChange('dresscodeImages', [...formData.dresscodeImages, ...validFiles]);
                                                } else {
                                                    toast.error('服装サンプル画像は最大3枚までアップロードできます');
                                                }
                                            }}
                                        >
                                            <div className="text-center">
                                                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                                <span className="text-sm text-gray-500">画像を選択 または ドラッグ&ドロップ</span>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handleDresscodeImageUpload}
                                                className="hidden"
                                            />
                                        </label>
                                    )}

                                    {/* 既存の服装サンプル画像 */}
                                    {formData.existingDresscodeImages.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-xs text-gray-500 mb-2">登録済み画像:</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {formData.existingDresscodeImages.map((url, index) => (
                                                    <div key={`existing-dress-${index}`} className="relative">
                                                        <img
                                                            src={url}
                                                            alt={`登録済み画像 ${index + 1}`}
                                                            className="w-full h-24 object-cover rounded border border-gray-300"
                                                        />
                                                        <button
                                                            onClick={() => removeExistingDresscodeImage(index)}
                                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-2">
                                        {formData.dresscodeImages.map((file, index) => (
                                            <div key={index} className="relative">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={`服装サンプル ${index + 1}`}
                                                    className="w-full h-24 object-cover rounded"
                                                />
                                                <button
                                                    onClick={() => removeDresscodeImage(index)}
                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    持ち物・その他（5つまで入力可能）
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={belongingInput}
                                        onChange={(e) => setBelongingInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addToArray('belongings', belongingInput, setBelongingInput)}
                                        disabled={formData.belongings.length >= 5}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                                        placeholder="持ち物・その他を追加"
                                    />
                                    <button
                                        onClick={() => addToArray('belongings', belongingInput, setBelongingInput)}
                                        disabled={formData.belongings.length >= 5}
                                        className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300"
                                    >
                                        追加
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.belongings.map((item, index) => (
                                        <span key={index} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded flex items-center gap-2">
                                            {item}
                                            <button onClick={() => removeFromArray('belongings', index)} className="text-gray-500 hover:text-red-600">×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== その他 ===== */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">その他</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    アイコン <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-blue-600 mb-2">チェックが多いほどより多くのワーカーから応募がきます!</p>
                                <div className={`grid grid-cols-3 gap-2 p-2 border rounded ${showErrors && formData.icons.length === 0 ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                    {ICON_OPTIONS.map(option => (
                                        <label key={option} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.icons.includes(option)}
                                                onChange={() => toggleArrayItem('icons', option)}
                                                className="rounded text-blue-600"
                                            />
                                            <span className="text-sm">{option}</span>
                                        </label>
                                    ))}
                                </div>
                                {showErrors && formData.icons.length === 0 && (
                                    <p className="text-red-500 text-xs mt-1">アイコンを選択してください</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    その他添付文章（3つまで）
                                </label>
                                <p className="text-xs text-red-500 mb-2">登録された文章は公開されます</p>
                                <p className="text-xs text-gray-500 mb-3">20MB以下 / 画像(JPG, PNG, HEIC等)・PDF・Word・Excel・テキスト形式</p>
                                <div className="space-y-2">
                                    {(formData.existingAttachments.length + formData.attachments.length) < 3 && (
                                        <label
                                            className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors"
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                                const files = Array.from(e.dataTransfer.files);
                                                const totalAttachments = formData.existingAttachments.length + formData.attachments.length + files.length;
                                                if (totalAttachments <= 3) {
                                                    handleInputChange('attachments', [...formData.attachments, ...files]);
                                                } else {
                                                    toast.error('添付ファイルは最大3つまでです');
                                                }
                                            }}
                                        >
                                            <div className="text-center">
                                                <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                                                <span className="text-sm text-gray-500">ファイルを選択 または ドラッグ&ドロップ</span>
                                            </div>
                                            <input
                                                type="file"
                                                multiple
                                                onChange={handleAttachmentUpload}
                                                className="hidden"
                                            />
                                        </label>
                                    )}

                                    {/* 既存の添付ファイル */}
                                    <div className="space-y-2">
                                        {formData.existingAttachments.map((url, index) => {
                                            const fileName = url.split('/').pop() || '添付ファイル';
                                            return (
                                                <div key={`existing-att-${index}`} className="flex items-center justify-between p-2 border border-blue-100 bg-blue-50 rounded">
                                                    <span className="text-sm truncate max-w-[80%]">
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                            {decodeURIComponent(fileName)}
                                                        </a>
                                                        <span className="ml-2 text-xs text-gray-500">(登録済み)</span>
                                                    </span>
                                                    <button
                                                        onClick={() => removeExistingAttachment(index)}
                                                        className="p-1 text-red-500 hover:text-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="space-y-2">
                                        {formData.attachments.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                                                <span className="text-sm">{file.name}</span>
                                                <button
                                                    onClick={() => removeAttachment(index)}
                                                    className="p-1 text-red-500 hover:text-red-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    労働条件通知書 <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-500 mb-2">入力いただいた情報を元に作成しています。</p>
                                <p className="text-xs text-gray-500 mb-3">「解雇の事由/その他関連する事項」のみ下記から変更可能です</p>
                                <button
                                    type="button"
                                    onClick={() => toast('労働条件通知書の表示機能は開発中です', { icon: '🚧' })}
                                    className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors mb-3"
                                >
                                    労働条件通知書
                                </button>
                                <textarea
                                    value={formData.dismissalReasons}
                                    onChange={(e) => handleInputChange('dismissalReasons', e.target.value)}
                                    rows={12}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* プレビューモーダル */}
            <TemplatePreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                templateData={{
                    ...formData,
                    images: previewImages,
                    dresscodeImages: [
                        ...formData.existingDresscodeImages,
                        ...formData.dresscodeImages.map(file => URL.createObjectURL(file))
                    ],
                    attachments: [
                        ...formData.existingAttachments,
                        ...formData.attachments.map(file => URL.createObjectURL(file))
                    ]
                }}
                facilityData={{
                    id: facilityData?.id || 0,
                    facilityName: facilityName,
                    address: facilityData?.address || '',
                    prefecture: facilityData?.prefecture || '',
                    city: facilityData?.city || '',
                    serviceType: facilityData?.service_type || '介護施設',
                    mapImage: facilityData?.map_image || null,
                    managerName: facilityData?.staff_same_as_manager
                        ? (facilityData.manager_last_name && facilityData.manager_first_name ? `${facilityData.manager_last_name} ${facilityData.manager_first_name}` : '担当者')
                        : (facilityData?.staff_last_name && facilityData?.staff_first_name ? `${facilityData.staff_last_name} ${facilityData.staff_first_name}` : '担当者'),
                    managerPhoto: facilityData?.staff_photo || null,
                    managerGreeting: facilityData?.staff_greeting || null,
                }}
            />
        </div>
    );
}
