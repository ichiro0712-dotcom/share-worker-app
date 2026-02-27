'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, MapPin, Upload, X, Loader2, ArrowLeft, ChevronLeft, ChevronRight, Clock, DollarSign, Briefcase, FileText, CheckCircle, AlertCircle, Info, AlertTriangle, Star, Plus, Trash2, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useErrorToast } from '@/components/ui/PersistentErrorToast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';
import AddressSelector from '@/components/ui/AddressSelector';
import { JobConfirmModal } from '@/components/admin/JobConfirmModal';
import { JobPreviewModal } from '@/components/admin/JobPreviewModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { calculateDailyWage, calculateWorkingHours, getFilteredTransportationFeeOptions, calculateMinTransportationFee } from '@/utils/salary';
import { getCurrentTime } from '@/utils/debugTime';
import { validateImageFiles, validateAttachmentFiles } from '@/utils/fileValidation';
import { directUploadMultiple } from '@/utils/directUpload';
import { createJobs, updateJob, getAdminJobTemplates, getFacilityInfo, getJobById, getLimitedJobTargetCounts, getOfferTemplates, createOfferTemplate, updateOfferTemplate, deleteOfferTemplate } from '@/src/lib/actions';
import { getSystemTemplates, getJobDescriptionFormats, getDismissalReasonsFromLaborTemplate } from '@/src/lib/content-actions';
import {
    JOB_TYPES,
    JOB_TYPE_OPTIONS,
    JOB_TYPE_LABELS,
    SWITCH_TO_NORMAL_OPTIONS,
    WORK_CONTENT_OPTIONS,
    ICON_OPTIONS,
    BREAK_TIME_OPTIONS,
    TRANSPORTATION_FEE_OPTIONS,
    TRANSPORTATION_FEE_MAX,
    RECRUITMENT_START_DAY_OPTIONS,
    RECRUITMENT_END_DAY_OPTIONS,
    HOUR_OPTIONS,
    END_HOUR_OPTIONS,
    MINUTE_OPTIONS,
    WORK_FREQUENCY_ICONS,
} from '@/constants';
import type { JobTypeValue } from '@/constants/job';
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';
import { DEFAULT_DISMISSAL_REASONS } from '@/constants/employment';

// 型定義
interface TemplateData {
    id: number;
    name: string;
    title: string;
    startTime: string;
    endTime: string;
    breakTime: number;
    hourlyWage: number;
    transportationFee: number;
    recruitmentCount: number;
    qualifications: string[];
    workContent: string[];
    description: string | null;
    skills: string[];
    dresscode: string[];
    belongings: string[];
    tags: string[];
    images: string[];
    dresscodeImages?: string[];
    attachments?: string[];
    notes: string | null;
}

interface FacilityData {
    id: number;
    facilityName: string;
    address: string;
    prefecture?: string;
    city?: string;
    addressLine?: string;
    building?: string;
    mapImage?: string | null;
    managerLastName?: string | null;
    managerFirstName?: string | null;
    staffSameAsManager?: boolean;
    staffLastName?: string | null;
    staffFirstName?: string | null;
    staffPhoto?: string | null;
    staffGreeting?: string | null;
}

interface ExistingWorkDate {
    id: number;
    date: string;
    recruitmentCount: number;
    appliedCount: number;
}

interface InitialData {
    templates?: TemplateData[];
    facilityInfo?: FacilityData | null;
    formats?: { id: number; label: string; content: string }[];
    dismissalReasons?: string;
}

interface OfferTargetWorker {
    id: number;
    name: string;
    profileImage: string | null;
}

interface OfferTemplate {
    id: number;
    name: string;
    message: string;
}

export interface JobFormProps {
    mode: 'create' | 'edit';
    jobId?: string;
    initialData?: InitialData;
    isOfferMode?: boolean;
    offerTargetWorker?: OfferTargetWorker | null;
}

export default function JobForm({ mode, jobId, initialData, isOfferMode = false, offerTargetWorker }: JobFormProps) {
    const router = useRouter();
    const { mutate: globalMutate } = useSWRConfig();
    const { showDebugError } = useDebugError();
    const { admin, isAdmin, isAdminLoading } = useAuth();

    // === 共通 State ===
    // initialDataがある場合はcreateモードでもロード不要（データ事前取得済み）
    const [isLoading, setIsLoading] = useState(mode === 'edit' || !initialData);
    const [isSaving, setIsSaving] = useState(false);
    // 初期データ取得済みフラグ（useEffectの再実行でformDataが上書きされるのを防ぐ）
    const [isInitialized, setIsInitialized] = useState(false);
    // バリデーションエラー表示用
    const [showErrors, setShowErrors] = useState(false);
    // 最低賃金バリデーション用
    const [minimumWage, setMinimumWage] = useState<number | null>(null);
    const [jobTemplates, setJobTemplates] = useState<TemplateData[]>(initialData?.templates || []);
    const [facilityInfo, setFacilityInfo] = useState<FacilityData | null>(initialData?.facilityInfo || null);
    const [jobDescriptionFormats, setJobDescriptionFormats] = useState<{ id: number; label: string; content: string }[]>(initialData?.formats || []);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // プレビュー用
    const [showPreview, setShowPreview] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewDresscodeImages, setPreviewDresscodeImages] = useState<string[]>([]);

    // 新規作成用 State
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);

    // 切り替え設定へのRef（バリデーションエラー時にスクロールするため）
    const switchSettingRef = useRef<HTMLDivElement>(null);

    // 条件設定用 State
    const [skillInput, setSkillInput] = useState('');
    const [dresscodeInput, setDresscodeInput] = useState('');
    const [belongingInput, setBelongingInput] = useState('');

    // 編集用 State
    const [existingWorkDates, setExistingWorkDates] = useState<ExistingWorkDate[]>([]);
    const [addedWorkDates, setAddedWorkDates] = useState<string[]>([]);
    const [removedWorkDateIds, setRemovedWorkDateIds] = useState<number[]>([]);

    // 募集条件設定
    const [recruitmentOptions, setRecruitmentOptions] = useState({
        weeklyFrequency: null as 2 | 3 | 4 | 5 | null,
    });

    // 限定求人の対象者数
    const [limitedJobTargetCounts, setLimitedJobTargetCounts] = useState<{
        workedCount: number;
        favoriteCount: number;
    }>({ workedCount: 0, favoriteCount: 0 });

    // オファーテンプレート関連
    const [offerTemplates, setOfferTemplates] = useState<OfferTemplate[]>([]);
    const [selectedOfferTemplateId, setSelectedOfferTemplateId] = useState<number | null>(null);
    const [showOfferTemplateModal, setShowOfferTemplateModal] = useState(false);
    const [editingOfferTemplate, setEditingOfferTemplate] = useState<OfferTemplate | null>(null);
    const [isCreatingOfferTemplate, setIsCreatingOfferTemplate] = useState(false);
    const [newOfferTemplateName, setNewOfferTemplateName] = useState('');
    const [newOfferTemplateMessage, setNewOfferTemplateMessage] = useState('');

    // フォームデータ
    const [formData, setFormData] = useState({
        facilityId: null as number | null,
        jobType: 'NORMAL' as JobTypeValue,
        recruitmentCount: 1,
        title: '',
        name: '', // テンプレート名（保存時は使われないが互換性のため）
        startTime: '06:00',
        endTime: '15:00',
        breakTime: 60,
        hourlyWage: 1200,
        transportationFee: 500,
        workContent: [] as string[],
        jobDescription: '',
        qualifications: [] as string[],
        skills: [] as string[],
        dresscode: [] as string[],
        belongings: [] as string[],
        icons: [] as string[],
        images: [] as File[],
        existingImages: [] as string[],
        dresscodeImages: [] as File[],
        existingDresscodeImages: [] as string[],
        attachments: [] as File[],
        existingAttachments: [] as string[],
        tags: [] as string[],
        notes: '',
        // 新規作成用
        recruitmentStartDay: 0,
        recruitmentStartTime: '',
        recruitmentEndDay: 0,
        recruitmentEndTime: '',
        // 共通
        genderRequirement: '不問',
        dismissalReasons: '',
        requiresInterview: false,
        // 限定求人用
        switchToNormalDaysBefore: null as number | null,
        // オファー用
        targetWorkerId: null as number | null,
        offerMessage: '',
        // 住所情報
        postalCode: '',
        prefecture: '',
        city: '',
        addressLine: '',
        building: '',
        address: '',
    });

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

    // 実働時間（分）を計算して、交通費選択肢をフィルタリング
    const workingMinutes = workingHours * 60;
    const filteredTransportationFeeOptions = getFilteredTransportationFeeOptions(
        workingMinutes,
        TRANSPORTATION_FEE_OPTIONS
    );
    const minTransportationFee = calculateMinTransportationFee(workingMinutes);

    // 最低賃金チェック
    const isBelowMinimumWage = minimumWage !== null
        && formData.hourlyWage > 0
        && formData.hourlyWage < minimumWage;

    // 勤務時間変更時に、交通費が選択肢外になった場合は自動調整
    useEffect(() => {
        if (workingMinutes <= 0) return;

        const currentFee = formData.transportationFee;
        // 0円（なし）は常にOK
        if (currentFee === 0) return;

        // 現在の値が最低額を下回っている場合は自動調整
        if (currentFee < minTransportationFee) {
            handleInputChange('transportationFee', minTransportationFee);
        }
    }, [workingMinutes, minTransportationFee]);

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

    // === 初期データ取得 ===
    useEffect(() => {
        // 既に初期化済みの場合は何もしない（formDataの上書きを防ぐ）
        if (isInitialized) return;

        if (isAdminLoading) return;
        if (!isAdmin || !admin) {
            router.push('/admin/login');
            return;
        }

        // initialDataが提供されている場合（JobFormWrapperから呼ばれた場合）
        if (initialData) {
            if (mode === 'create') {
                // 新規作成モード：facilityInfoからformDataを更新
                if (initialData.facilityInfo) {
                    const facilityData = initialData.facilityInfo;
                    setFormData(prev => ({
                        ...prev,
                        facilityId: admin.facilityId,
                        dismissalReasons: initialData.dismissalReasons || '',
                        // 新規作成時は施設の住所をデフォルトセット
                        prefecture: facilityData.prefecture || '',
                        city: facilityData.city || '',
                        addressLine: facilityData.addressLine || '',
                        building: facilityData.building || '',
                        address: facilityData.address || '',
                        // オファーモードの場合
                        ...(isOfferMode && offerTargetWorker ? {
                            jobType: 'OFFER' as JobTypeValue,
                            targetWorkerId: offerTargetWorker.id,
                            recruitmentCount: 1, // オファーは1名固定
                            requiresInterview: false, // オファーは審査なし
                        } : {}),
                    }));
                }
                setIsInitialized(true);
                setIsLoading(false);
                return;
            } else if (mode === 'edit' && jobId) {
                // 編集モード：initialDataから基本データをセット、追加で既存求人データを取得
                const loadEditData = async () => {
                    try {
                        await fetchEditData(jobId, initialData.facilityInfo, initialData.dismissalReasons || '');
                    } catch (error) {
                        const debugInfo = extractDebugInfo(error);
                        showDebugError({
                            type: 'fetch',
                            operation: '求人編集データ読込',
                            message: debugInfo.message,
                            details: debugInfo.details,
                            stack: debugInfo.stack,
                            context: { jobId }
                        });
                        console.error('Failed to load edit data:', error);
                        toast.error('データの読み込みに失敗しました');
                        setIsLoading(false);
                    }
                    setIsInitialized(true);
                };
                loadEditData();
                return;
            }
        }

        // 従来の処理（initialDataがない場合）
        const loadData = async () => {
            try {
                const [templates, facility, formats, dismissalReasons] = await Promise.all([
                    getAdminJobTemplates(admin.facilityId),
                    getFacilityInfo(admin.facilityId),
                    getJobDescriptionFormats(),
                    getDismissalReasonsFromLaborTemplate(),
                ]);

                setJobTemplates(templates);
                setJobDescriptionFormats(formats);

                if (facility) {
                    const facilityData = {
                        id: facility.id,
                        facilityName: facility.facilityName,
                        address: facility.address || '',
                        prefecture: facility.prefecture || '',
                        city: facility.city || '',
                        addressLine: facility.addressLine || '',
                        building: (facility as any).building || '',
                        managerLastName: facility.managerLastName || null,
                        managerFirstName: facility.managerFirstName || null,
                        staffSameAsManager: facility.staffSameAsManager || false,
                        staffLastName: facility.staffLastName || null,
                        staffFirstName: facility.staffFirstName || null,
                        staffPhoto: facility.staffPhoto || null,
                        staffGreeting: facility.staffGreeting || null,
                    };
                    setFacilityInfo(facilityData);

                    if (mode === 'create') {
                        setFormData(prev => ({
                            ...prev,
                            facilityId: admin.facilityId,
                            dismissalReasons: dismissalReasons,
                            // 新規作成時は施設の住所をデフォルトセット
                            prefecture: facilityData.prefecture,
                            city: facilityData.city,
                            addressLine: facilityData.addressLine,
                            building: facilityData.building,
                            address: facilityData.address,
                        }));
                    }
                }

                if (mode === 'edit' && jobId) {
                    await fetchEditData(jobId, facility, dismissalReasons);
                } else {
                    setIsInitialized(true);
                    setIsLoading(false);
                }

            } catch (error) {
                const debugInfo = extractDebugInfo(error);
                showDebugError({
                    type: 'fetch',
                    operation: '求人初期データ取得',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { facilityId: admin.facilityId }
                });
                console.error('Failed to load initial data:', error);
                toast.error('データの読み込みに失敗しました');
                setIsInitialized(true);
                setIsLoading(false);
            }
        };

        loadData();
    }, [isInitialized, isAdmin, admin, isAdminLoading, router, mode, jobId, initialData]);

    // 編集モードデータの取得
    const fetchEditData = async (id: string, facility: any, defaultDismissalReasons: string) => {
        try {
            const jobData = await getJobById(id);

            if (!jobData) {
                showDebugError({
                    type: 'fetch',
                    operation: '求人データ取得(存在せず)',
                    message: '求人が見つかりません',
                    context: { jobId: id }
                });
                toast.error('求人が見つかりません');
                router.push('/admin/jobs');
                return;
            }

            if (jobData.facility_id !== admin?.facilityId) {
                showDebugError({
                    type: 'fetch',
                    operation: '求人権限エラー',
                    message: '編集権限がありません',
                    context: { jobId: id, facilityId: admin?.facilityId }
                });
                toast.error('編集権限がありません');
                router.push('/admin/jobs');
                return;
            }

            // 勤務日設定
            if (jobData.workDates && jobData.workDates.length > 0) {
                setExistingWorkDates(jobData.workDates.map((wd: any) => ({
                    id: wd.id,
                    date: wd.work_date.split('T')[0],
                    recruitmentCount: wd.recruitment_count,
                    appliedCount: wd.applied_count,
                })));
                setCurrentMonth(new Date(jobData.workDates[0].work_date));
            }

            // break_timeのパース
            const parseBreakTime = (breakTimeStr: string | number | null): number => {
                if (typeof breakTimeStr === 'number') return breakTimeStr;
                if (!breakTimeStr) return 0;
                const match = String(breakTimeStr).match(/(\d+)/);
                return match ? parseInt(match[1]) : 0;
            };

            // タグからrecruitmentOptionsを復元
            const existingTags = jobData.tags || [];
            let weeklyFreq: 2 | 3 | 4 | 5 | null = null;
            for (const [freq, icon] of Object.entries(WORK_FREQUENCY_ICONS)) {
                if (existingTags.includes(icon as string)) {
                    weeklyFreq = parseInt(freq) as 2 | 3 | 4 | 5;
                    break;
                }
            }
            setRecruitmentOptions({
                weeklyFrequency: (jobData.weekly_frequency ?? weeklyFreq) as 2 | 3 | 4 | 5 | null,
            });

            // フォームデータ設定
            setFormData(prev => ({
                ...prev,
                facilityId: jobData.facility_id,
                title: jobData.title || '',
                jobType: ((jobData as any).job_type as JobTypeValue) || 'NORMAL',
                recruitmentCount: jobData.workDates?.[0]?.recruitment_count || 1,
                startTime: jobData.start_time || '09:00',
                endTime: jobData.end_time || '18:00',
                breakTime: parseBreakTime(jobData.break_time),
                hourlyWage: jobData.hourly_wage || 1200,
                transportationFee: jobData.transportation_fee || 0,
                workContent: jobData.work_content || [],
                jobDescription: jobData.overview || '',
                qualifications: jobData.required_qualifications || [],
                skills: jobData.required_experience || [],
                dresscode: jobData.dresscode || [],
                belongings: jobData.belongings || [],
                icons: existingTags,
                existingImages: jobData.images || [],
                existingDresscodeImages: jobData.dresscode_images || [],
                existingAttachments: jobData.attachments || [],
                dismissalReasons: (jobData as any).dismissalReasons || (jobData as any).dismissal_reasons || defaultDismissalReasons,
                requiresInterview: jobData.requires_interview || false,
                switchToNormalDaysBefore: (jobData as any).switch_to_normal_days_before ?? null,
                // 募集開始日時
                recruitmentStartDay: (jobData as any).recruitment_start_day ?? 0,
                recruitmentStartTime: (jobData as any).recruitment_start_time || '',
                recruitmentEndDay: jobData.deadline_days_before ?? 1,
                // 住所
                prefecture: jobData.prefecture || facility?.prefecture || '',
                city: jobData.city || facility?.city || '',
                addressLine: jobData.address_line || facility?.addressLine || '',
                building: '', // DBにないので空
                address: jobData.address || facility?.address || '',
            }));

        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: '求人データ編集取得(例外)',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { jobId: id }
            });
            console.error('Failed to fetch edit data:', error);
            toast.error('求人データの取得に失敗しました');
        } finally {
            setIsInitialized(true);
            setIsLoading(false);
        }
    };

    // === 限定求人対象者数を取得 ===
    useEffect(() => {
        if (!admin?.facilityId) return;

        const fetchTargetCounts = async () => {
            try {
                const counts = await getLimitedJobTargetCounts(admin.facilityId);
                console.log('[JobForm] Limited job target counts:', counts);
                setLimitedJobTargetCounts(counts);
            } catch (error) {
                console.error('[JobForm] Failed to fetch limited job target counts:', error);
            }
        };

        fetchTargetCounts();
    }, [admin?.facilityId]);

    // === オファーテンプレートを取得（オファーモード時のみ） ===
    useEffect(() => {
        if (!isOfferMode || !admin?.facilityId) return;

        const fetchOfferTemplates = async () => {
            try {
                const templates = await getOfferTemplates(admin.facilityId);
                setOfferTemplates(templates as OfferTemplate[]);
            } catch (error) {
                console.error('[JobForm] Failed to fetch offer templates:', error);
            }
        };

        fetchOfferTemplates();
    }, [isOfferMode, admin?.facilityId]);

    // === 施設都道府県の最低賃金を取得 ===
    useEffect(() => {
        if (!facilityInfo?.prefecture) return;
        const controller = new AbortController();
        fetch(`/api/minimum-wage?prefecture=${encodeURIComponent(facilityInfo.prefecture)}`, {
            signal: controller.signal,
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch minimum wage');
                return res.json();
            })
            .then(data => setMinimumWage(data.hourlyWage ?? null))
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setMinimumWage(null);
                }
            });
        return () => controller.abort();
    }, [facilityInfo?.prefecture]);

    // オファーテンプレートの再取得
    const refreshOfferTemplates = async () => {
        if (!admin?.facilityId) return;
        const templates = await getOfferTemplates(admin.facilityId);
        setOfferTemplates(templates as OfferTemplate[]);
    };

    // オファーテンプレート作成
    const handleCreateOfferTemplate = async () => {
        if (!admin?.facilityId || !newOfferTemplateName.trim() || !newOfferTemplateMessage.trim()) {
            toast.error('タイトルと内容を入力してください');
            return;
        }
        try {
            const result = await createOfferTemplate(admin.facilityId, newOfferTemplateName.trim(), newOfferTemplateMessage.trim());
            if (result.success) {
                toast.success('テンプレートを作成しました');
                setNewOfferTemplateName('');
                setNewOfferTemplateMessage('');
                setIsCreatingOfferTemplate(false);
                await refreshOfferTemplates();
            } else {
                toast.error(result.error || 'テンプレートの作成に失敗しました');
            }
        } catch (error) {
            console.error('Failed to create offer template:', error);
            toast.error('テンプレートの作成に失敗しました');
        }
    };

    // オファーテンプレート更新
    const handleUpdateOfferTemplate = async () => {
        if (!admin?.facilityId || !editingOfferTemplate || !newOfferTemplateName.trim() || !newOfferTemplateMessage.trim()) {
            toast.error('タイトルと内容を入力してください');
            return;
        }
        try {
            const result = await updateOfferTemplate(editingOfferTemplate.id, newOfferTemplateName.trim(), newOfferTemplateMessage.trim(), admin.facilityId);
            if (result.success) {
                toast.success('テンプレートを更新しました');
                setEditingOfferTemplate(null);
                setNewOfferTemplateName('');
                setNewOfferTemplateMessage('');
                await refreshOfferTemplates();
            } else {
                toast.error(result.error || 'テンプレートの更新に失敗しました');
            }
        } catch (error) {
            console.error('Failed to update offer template:', error);
            toast.error('テンプレートの更新に失敗しました');
        }
    };

    // オファーテンプレート削除
    const handleDeleteOfferTemplate = async (templateId: number) => {
        if (!admin?.facilityId) return;
        if (!confirm('このテンプレートを削除しますか？')) return;
        try {
            const result = await deleteOfferTemplate(templateId, admin.facilityId);
            if (result.success) {
                toast.success('テンプレートを削除しました');
                await refreshOfferTemplates();
            } else {
                toast.error(result.error || 'テンプレートの削除に失敗しました');
            }
        } catch (error) {
            console.error('Failed to delete offer template:', error);
            toast.error('テンプレートの削除に失敗しました');
        }
    };

    // === ハンドラー ===

    // 勤務日までの日数に応じて切り替え日数のデフォルト値を計算
    const calculateDefaultSwitchDays = (workDates: string[]): number | null => {
        if (workDates.length === 0) return null;

        const now = getCurrentTime();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 最も近い勤務日を取得
        const earliestDate = workDates
            .map(d => new Date(d))
            .sort((a, b) => a.getTime() - b.getTime())[0];

        const daysUntilWork = Math.ceil((earliestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // 仕様に基づくデフォルト値
        if (daysUntilWork >= 7) return 7;
        if (daysUntilWork >= 3) return 3;
        if (daysUntilWork >= 1) return 1;
        return null; // 1日未満は切り替えなし
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // 配列操作
    const toggleArrayItem = (field: string, item: string) => {
        const currentArray = formData[field as keyof typeof formData] as string[];
        const isRemoving = currentArray.includes(item);
        let newArray = isRemoving
            ? currentArray.filter(i => i !== item)
            : [...currentArray, item];

        handleInputChange(field, newArray);

        // アイコンの連動ロジック
        if (field === 'icons') {
            const frequencyEntry = Object.entries(WORK_FREQUENCY_ICONS).find(([_, icon]) => icon === item);
            if (frequencyEntry) {
                const frequencyValue = parseInt(frequencyEntry[0]) as 2 | 3 | 4 | 5;
                if (isRemoving) {
                    setRecruitmentOptions(prev => ({
                        ...prev,
                        weeklyFrequency: prev.weeklyFrequency === frequencyValue ? null : prev.weeklyFrequency,
                    }));
                } else {
                    setRecruitmentOptions(prev => ({
                        ...prev,
                        weeklyFrequency: frequencyValue,
                    }));
                    // 他の頻度アイコンを削除
                    const otherIcons = Object.values(WORK_FREQUENCY_ICONS).filter(icon => icon !== item);
                    handleInputChange('icons', newArray.filter(icon => !otherIcons.includes(icon as any)));
                }
            }
        }
    };



    const addToArray = (field: string, value: string, setInput: (val: string) => void) => {
        if (!value.trim()) return;
        const currentArray = formData[field as keyof typeof formData] as string[];
        if (currentArray.includes(value)) {
            toast.error('既に追加されています');
            return;
        }
        handleInputChange(field, [...currentArray, value]);
        setInput('');
    };



    const removeFromArray = (field: string, index: number) => {
        handleInputChange(field, (formData[field as keyof typeof formData] as string[]).filter((_, i) => i !== index));
    };

    const removeImage = (index: number) => {
        handleInputChange('images', formData.images.filter((_, i) => i !== index));
    };

    const removeExistingImage = (index: number) => {
        handleInputChange('existingImages', formData.existingImages.filter((_, i) => i !== index));
    };

    // 服装画像アップロード
    const handleDresscodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const result = validateImageFiles(files);

        // エラーがあれば表示
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

    // 画像アップロード
    const handleImageUpload = (fields: { new: string, existing: string }, e: React.ChangeEvent<HTMLInputElement> | File[]) => {
        const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
        const result = validateImageFiles(files);

        result.errors.forEach(err => toast.error(err));
        if (result.validFiles.length === 0) return;

        const currentNew = formData[fields.new as keyof typeof formData] as File[];
        const currentExisting = formData[fields.existing as keyof typeof formData] as string[];

        const total = currentNew.length + currentExisting.length + result.validFiles.length;
        if (total <= 3) {
            handleInputChange(fields.new, [...currentNew, ...result.validFiles]);
        } else {
            toast.error('画像は最大3枚までです');
        }
    };

    // 添付ファイルアップロード
    const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const result = validateAttachmentFiles(files);

        result.errors.forEach(err => toast.error(err));
        if (result.validFiles.length === 0) return;

        const total = formData.attachments.length + formData.existingAttachments.length + result.validFiles.length;
        if (total <= 3) {
            handleInputChange('attachments', [...formData.attachments, ...result.validFiles]);
        } else {
            toast.error('添付ファイルは最大3つまでです');
        }
    };

    const removeAttachment = (index: number) => {
        handleInputChange('attachments', formData.attachments.filter((_, i) => i !== index));
    };

    const removeExistingAttachment = (index: number) => {
        handleInputChange('existingAttachments', formData.existingAttachments.filter((_, i) => i !== index));
    };

    // 切り替え日数バリデーション関数
    // 「X日前に切り替え」とは勤務日のX日前に通常求人になるということ
    // 例: 勤務日が3日後で「1日前に切り替え」→ 2日後に切り替わる → OK
    // 例: 勤務日が1日後（明日）で「1日前に切り替え」→ 今日切り替わる必要がある → NG（すでに今日）
    // したがって、switchDays < daysUntilWork である必要がある（等号なし）
    const validateSwitchDays = (workDates: string[], switchDays: number | null): { valid: boolean; daysUntilWork: number } => {
        if (switchDays === null || workDates.length === 0) return { valid: true, daysUntilWork: 0 };

        const now = getCurrentTime();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 最も近い勤務日を取得
        const earliestDate = workDates
            .map(d => new Date(d))
            .sort((a, b) => a.getTime() - b.getTime())[0];

        const daysUntilWork = Math.ceil((earliestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // switchDays < daysUntilWork でなければならない
        // 例: 勤務日が2日後(daysUntilWork=2)なら、1日前切り替え(switchDays=1)はOK（明日切り替わる）
        // 例: 勤務日が1日後(daysUntilWork=1)なら、1日前切り替え(switchDays=1)はNG（今日切り替える必要がある）
        return {
            valid: switchDays < daysUntilWork,
            daysUntilWork
        };
    };

    // カレンダー操作
    const handleDateClick = (dateString: string) => {
        if (mode === 'create') {
            let newDates: string[];
            if (selectedDates.includes(dateString)) {
                newDates = selectedDates.filter(d => d !== dateString);
            } else {
                newDates = [...selectedDates, dateString].sort();
            }

            // 限定求人の場合、バリデーションを行う
            if (formData.jobType === 'LIMITED_WORKED' || formData.jobType === 'LIMITED_FAVORITE') {
                // nullの場合はデフォルト値7を使用
                const switchDays = formData.switchToNormalDaysBefore ?? 7;
                const { valid, daysUntilWork } = validateSwitchDays(newDates, switchDays);
                if (!valid && newDates.length > 0) {
                    // より分かりやすいエラーメッセージ
                    const requiredDays = switchDays + 1; // X日前に切り替えるには少なくともX+1日先の勤務日が必要
                    toast.error(
                        `「${switchDays}日前に切り替え」を選択中ですが、最短の勤務日まで${daysUntilWork}日しかありません。少なくとも${requiredDays}日以上先の日付を選択するか、切り替え設定を変更してください。`,
                        { duration: 5000 }
                    );
                    // 設定箇所にスクロール
                    switchSettingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return; // 日付選択をキャンセル
                }
            }

            setSelectedDates(newDates);
        } else {
            // 編集モード
            const existing = existingWorkDates.find(wd => wd.date === dateString);
            if (existing) {
                if (removedWorkDateIds.includes(existing.id)) {
                    setRemovedWorkDateIds(prev => prev.filter(id => id !== existing.id));
                } else {
                    if (existing.appliedCount > 0) {
                        toast.error('応募がある勤務日は削除できません');
                        return;
                    }
                    setRemovedWorkDateIds(prev => [...prev, existing.id]);
                }
            } else {
                if (addedWorkDates.includes(dateString)) {
                    setAddedWorkDates(prev => prev.filter(d => d !== dateString));
                } else {
                    setAddedWorkDates(prev => [...prev, dateString]);
                }
            }
        }
    };



    // テンプレート挿入
    const handleInsertTemplate = async () => {
        try {
            const templates = await getSystemTemplates();
            if (templates.job_description_template) {
                const current = formData.jobDescription;
                const newDesc = current
                    ? `${current}\n\n${templates.job_description_template}`
                    : templates.job_description_template;
                handleInputChange('jobDescription', newDesc);
                toast.success('テンプレートを挿入しました');
            } else {
                toast.error('テンプレートがありません');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'fetch',
                operation: 'システムテンプレート取得',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack
            });
            console.error('Failed to insert template:', error);
            toast.error('テンプレート取得失敗');
        }
    };

    // テンプレート適用
    const handleTemplateSelect = (templateId: number) => {
        const template = jobTemplates.find(t => t.id === templateId);
        if (!template) return;

        setSelectedTemplateId(templateId);
        const templateTags = template.tags || [];

        // オプション再計算
        let weeklyFrequency: 2 | 3 | 4 | 5 | null = null;
        for (const [freq, icon] of Object.entries(WORK_FREQUENCY_ICONS)) {
            if (templateTags.includes(icon as string)) weeklyFrequency = parseInt(freq) as 2 | 3 | 4 | 5;
        }

        setRecruitmentOptions({
            weeklyFrequency,
        });

        setFormData(prev => ({
            ...prev,
            name: template.name,
            title: template.title,
            recruitmentCount: template.recruitmentCount,
            startTime: template.startTime,
            endTime: template.endTime,
            breakTime: template.breakTime,
            hourlyWage: template.hourlyWage,
            transportationFee: template.transportationFee,
            workContent: template.workContent || [],
            jobDescription: template.description || '',
            qualifications: template.qualifications || [],
            skills: template.skills || [],
            dresscode: template.dresscode || [],
            belongings: template.belongings || [],
            icons: templateTags,
            existingImages: template.images || [],
            existingDresscodeImages: template.dresscodeImages || [],
            existingAttachments: template.attachments || [],
            images: [],
            dresscodeImages: [],
            attachments: [],
        }));
    };

    const handleRecruitmentOptionChange = (value: number) => {
        const val = value as 2 | 3 | 4 | 5;
        const newValue = recruitmentOptions.weeklyFrequency === val ? null : val;
        setRecruitmentOptions(prev => ({ ...prev, weeklyFrequency: newValue }));

        const newIcon = newValue ? WORK_FREQUENCY_ICONS[newValue as keyof typeof WORK_FREQUENCY_ICONS] : null;
        const removeIcons = Object.values(WORK_FREQUENCY_ICONS);
        let newIcons = formData.icons.filter(i => !removeIcons.includes(i as any));
        if (newIcon) newIcons.push(newIcon);
        handleInputChange('icons', newIcons);
    };

    // 確認・保存
    const handleShowConfirm = () => {
        // 簡易バリデーション
        if (!formData.title) return toast.error('タイトルは必須です');
        if (mode === 'create' && selectedDates.length === 0) {
            return toast.error('勤務日を選択してください');
        }

        // 勤務日数バリデーション（weeklyFrequency設定時）
        if (recruitmentOptions.weeklyFrequency) {
            const workDateCount = mode === 'create' ? selectedDates.length : (existingWorkDates.length + addedWorkDates.length - removedWorkDateIds.length);
            if (workDateCount < recruitmentOptions.weeklyFrequency) {
                toast.error(`「${recruitmentOptions.weeklyFrequency}回以上勤務」を設定する場合、${recruitmentOptions.weeklyFrequency}日以上の勤務日が必要です`);
                return;
            }
        }
        if (!formData.startTime || !formData.endTime) return toast.error('勤務時間は必須です');
        if (minimumWage !== null && formData.hourlyWage > 0 && formData.hourlyWage < minimumWage) {
            return toast.error(`時給が${facilityInfo?.prefecture}の最低賃金（${minimumWage.toLocaleString()}円）を下回っています`);
        }

        setShowConfirm(true);
    };

    const handlePreview = () => {
        const newUrls = formData.images.map(f => URL.createObjectURL(f));
        const newDresscodeUrls = formData.dresscodeImages.map(f => URL.createObjectURL(f));
        setPreviewImages([...formData.existingImages, ...newUrls]);
        setPreviewDresscodeImages([...formData.existingDresscodeImages, ...newDresscodeUrls]);
        setShowPreview(true);
    };

    const { showError } = useErrorToast();

    const handleSave = async () => {
        if (isSaving) return;

        // バリデーションエラー表示を有効化
        setShowErrors(true);

        // バリデーション
        const errors: string[] = [];

        if (!formData.title?.trim()) errors.push('求人タイトルは必須です');
        if (!formData.startTime) errors.push('開始時刻は必須です');
        if (!formData.endTime) errors.push('終了時刻は必須です');
        if (!formData.hourlyWage || formData.hourlyWage <= 0) errors.push('時給は必須です');
        if (minimumWage !== null && formData.hourlyWage > 0 && formData.hourlyWage < minimumWage) {
            errors.push(`時給が${facilityInfo?.prefecture}の最低賃金（${minimumWage.toLocaleString()}円）を下回っています`);
        }
        if (!formData.recruitmentCount || formData.recruitmentCount <= 0) errors.push('募集人数は必須です');
        if (formData.qualifications.length === 0) errors.push('必要な資格を選択してください');

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

            // 実働時間 = 拘束時間 - 休憩時間
            const workMinutes = grossMinutes - formData.breakTime;

            // 実働8時間（480分）を超える場合 → 60分以上の休憩が必要
            if (workMinutes > 480 && formData.breakTime < 60) {
                errors.push('実働8時間を超える場合、休憩時間は60分以上必要です');
            }
            // 実働6時間（360分）を超える場合 → 45分以上の休憩が必要
            else if (workMinutes > 360 && formData.breakTime < 45) {
                errors.push('実働6時間を超える場合、休憩時間は45分以上必要です');
            }
        }

        // 限定求人の対象者チェック
        if (formData.jobType === 'LIMITED_WORKED' && limitedJobTargetCounts.workedCount === 0) {
            errors.push('限定求人（勤務済みの方）を作成するには、過去に勤務完了したワーカーが必要です');
        }
        if (formData.jobType === 'LIMITED_FAVORITE' && limitedJobTargetCounts.favoriteCount === 0) {
            errors.push('限定求人（お気に入りのみ）を作成するには、お気に入り登録しているワーカーが必要です');
        }

        // 限定求人の切り替え日数バリデーション
        if ((formData.jobType === 'LIMITED_WORKED' || formData.jobType === 'LIMITED_FAVORITE') && formData.switchToNormalDaysBefore !== null) {
            const now = getCurrentTime();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const workDatesToValidate = mode === 'create' ? selectedDates : existingWorkDates.map(wd => wd.date);

            if (workDatesToValidate.length > 0) {
                // 最も近い勤務日を取得
                const earliestDate = workDatesToValidate
                    .map(d => new Date(d))
                    .sort((a, b) => a.getTime() - b.getTime())[0];

                const daysUntilWork = Math.ceil((earliestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (formData.switchToNormalDaysBefore > daysUntilWork) {
                    errors.push(`最短の勤務日まで${daysUntilWork}日しかないため、${formData.switchToNormalDaysBefore}日前に通常求人へ切り替えることはできません。${daysUntilWork}日以下の値を選択してください。`);
                }
            }
        }

        // 新規作成時は勤務日必須
        if (mode === 'create') {
            if (selectedDates.length === 0) errors.push('勤務日は少なくとも1つ選択してください');
        }

        // 編集モードのバリデーション
        if (mode === 'edit') {
            const activeDatesCount = existingWorkDates.filter(d => !removedWorkDateIds.includes(d.id)).length + addedWorkDates.length;
            if (activeDatesCount === 0) errors.push('勤務日は少なくとも1つ必要です');
        }

        // 当日の求人は現在時刻+4時間以降の開始時刻が必要
        // JST（日本時間）で今日の日付を取得（toISOStringはUTCなので使わない）
        const now = getCurrentTime();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const workDatesToCheck = mode === 'create'
            ? selectedDates
            : [...existingWorkDates.filter(d => !removedWorkDateIds.includes(d.id)).map(d => d.date), ...addedWorkDates];

        if (workDatesToCheck.includes(todayStr) && formData.startTime) {
            const minStartTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4時間後
            const [startHour, startMinute] = formData.startTime.split(':').map(Number);
            const startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);

            if (startDateTime < minStartTime) {
                const minHour = minStartTime.getHours().toString().padStart(2, '0');
                const minMin = minStartTime.getMinutes().toString().padStart(2, '0');
                errors.push(`当日の求人は${minHour}:${minMin}以降の開始時刻を設定してください（現在時刻から4時間後以降）`);
            }
        }

        if (errors.length > 0) {
            toast.error(
                <div className="text-sm">
                    <p className="font-bold mb-1">入力内容を確認してください</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                        {errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                </div>
            );
            return;
        }

        setIsSaving(true);

        try {
            // 画像等のアップロード（署名付きURL方式）
            const adminSession = localStorage.getItem('admin_session') || '';
            const uploadWithSignedUrl = async (files: File[], type: 'job' | 'message') => {
                if (files.length === 0) return [];
                const results = await directUploadMultiple(files, {
                    uploadType: type,
                    adminSession,
                });
                const failed = results.filter(r => !r.success);
                if (failed.length > 0) {
                    throw new Error(failed[0].error || 'アップロードに失敗しました');
                }
                return results.filter(r => r.success && r.url).map(r => r.url!);
            };

            const newImageUrls = await uploadWithSignedUrl(formData.images, 'job');
            const newDressUrls = await uploadWithSignedUrl(formData.dresscodeImages, 'job');
            const newAttachUrls = await uploadWithSignedUrl(formData.attachments, 'job');

            const finalImages = [...formData.existingImages, ...newImageUrls];
            const finalDress = [...formData.existingDresscodeImages, ...newDressUrls];
            const finalAttach = [...formData.existingAttachments, ...newAttachUrls];

            if (mode === 'create') {
                // 新規作成
                let workDates = selectedDates;

                // オファーのみ審査なし固定（限定求人は審査あり/なし選択可能）
                const requiresInterview = formData.jobType === 'OFFER'
                    ? false
                    : formData.requiresInterview;

                const res = await createJobs({
                    facilityId: formData.facilityId!,
                    templateId: selectedTemplateId,
                    title: formData.title,
                    workDates: workDates,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    breakTime: formData.breakTime,
                    hourlyWage: formData.hourlyWage,
                    transportationFee: formData.transportationFee,
                    recruitmentCount: formData.recruitmentCount,
                    workContent: formData.workContent,
                    jobDescription: formData.jobDescription,
                    qualifications: formData.qualifications,
                    skills: formData.skills,
                    dresscode: formData.dresscode,
                    belongings: formData.belongings,
                    icons: formData.icons,
                    images: finalImages,
                    dresscodeImages: finalDress,
                    attachments: finalAttach,
                    recruitmentStartDay: formData.recruitmentStartDay,
                    recruitmentStartTime: formData.recruitmentStartTime || undefined,
                    recruitmentEndDay: formData.recruitmentEndDay,
                    recruitmentEndTime: formData.recruitmentEndTime || undefined,
                    weeklyFrequency: recruitmentOptions.weeklyFrequency,
                    requiresInterview: requiresInterview,
                    // 新規フィールド
                    jobType: formData.jobType,
                    switchToNormalDaysBefore: formData.switchToNormalDaysBefore,
                    // オファー用
                    targetWorkerId: formData.targetWorkerId,
                    offerMessage: formData.offerMessage || undefined,
                    // 住所情報
                    prefecture: formData.prefecture,
                    city: formData.city,
                    addressLine: formData.addressLine,
                    address: formData.address,
                });

                if (res.success) {
                    toast.success(isOfferMode ? 'オファーを送信しました' : '求人を作成しました');
                    // SWRキャッシュをクリアして一覧を更新
                    globalMutate((key) => typeof key === 'string' && key.includes('/api/admin/jobs'));
                    router.push('/admin/jobs');
                } else {
                    // オファー重複エラーなど、ユーザー向けのエラーはトーストで表示
                    toast.error(res.error || '作成に失敗しました');
                    setIsSaving(false);
                    return;
                }

            } else {
                // 更新
                const res = await updateJob(parseInt(jobId!), formData.facilityId!, {
                    title: formData.title,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    breakTime: formData.breakTime,
                    hourlyWage: formData.hourlyWage,
                    transportationFee: formData.transportationFee,
                    recruitmentCount: formData.recruitmentCount,
                    workContent: formData.workContent,
                    jobDescription: formData.jobDescription,
                    weeklyFrequency: recruitmentOptions.weeklyFrequency,
                    qualifications: formData.qualifications,
                    skills: formData.skills,
                    dresscode: formData.dresscode,
                    belongings: formData.belongings,
                    icons: formData.icons,
                    images: finalImages,
                    dresscodeImages: finalDress,
                    attachments: finalAttach,
                    addWorkDates: addedWorkDates,
                    removeWorkDateIds: removedWorkDateIds,
                    requiresInterview: formData.requiresInterview,
                    prefecture: formData.prefecture,
                    city: formData.city,
                    addressLine: formData.addressLine,
                    recruitmentStartDay: formData.recruitmentStartDay,
                    recruitmentStartTime: formData.recruitmentStartTime || undefined,
                    recruitmentEndDay: formData.recruitmentEndDay,
                    recruitmentEndTime: formData.recruitmentEndTime || undefined,
                });

                if (res.success) {
                    toast.success('求人を更新しました');
                    // SWRキャッシュをクリアして一覧を更新
                    globalMutate((key) => typeof key === 'string' && key.includes('/api/admin/jobs'));
                    router.push('/admin/jobs');
                } else {
                    throw new Error(res.error || '更新失敗');
                }
            }
        } catch (e: any) {
            const debugInfo = extractDebugInfo(e);
            showDebugError({
                type: mode === 'create' ? 'save' : 'update',
                operation: mode === 'create' ? '求人一括作成' : '求人更新',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId: formData.facilityId, jobId }
            });
            console.error(e);
            showError('SAVE_ERROR', `保存に失敗しました: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // === レンダリング用ヘルパー ===
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        return { daysInMonth: lastDay.getDate(), startingDayOfWeek: firstDay.getDay(), year, month };
    };

    const formatDate = (year: number, month: number, day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // === JSX ===
    return (
        <div className="h-full flex flex-col">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {mode === 'edit' && (
                            <button onClick={() => router.push('/admin/jobs')} className="p-2 hover:bg-gray-100 rounded">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-xl font-bold text-gray-900">{mode === 'create' ? '新規求人作成' : '求人編集'}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowPreview(true)}
                            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                        >
                            プレビュー
                        </button>
                        <button
                            onClick={handleShowConfirm}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
                        >
                            {isSaving && <LoadingSpinner size="sm" color="white" />}
                            {isSaving ? '保存中...' : (mode === 'create' ? (isOfferMode ? 'オファーする' : '公開する') : '更新する')}
                        </button>
                    </div>
                </div>
            </div>

            {/* フォーム */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* 基本 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">基本</h2>
                        <div className="space-y-4">
                            {/* オファーモード：対象ワーカー表示 */}
                            {isOfferMode && offerTargetWorker && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-center gap-4">
                                        {offerTargetWorker.profileImage ? (
                                            <img
                                                src={offerTargetWorker.profileImage}
                                                alt={offerTargetWorker.name}
                                                className="w-14 h-14 rounded-full object-cover border-2 border-blue-300"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 text-xl font-bold">
                                                {offerTargetWorker.name.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">{offerTargetWorker.name}さんへのオファー</p>
                                            <p className="text-sm text-gray-600">このワーカー専用の求人を作成します</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 1行目：テンプレート + 募集人数（オファーは1名固定で非表示） */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        テンプレート（任意）
                                    </label>
                                    <select
                                        value={selectedTemplateId || ''}
                                        onChange={(e) => e.target.value && handleTemplateSelect(Number(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        <option value="">テンプレートを選択（任意）</option>
                                        {jobTemplates.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        テンプレートを選択すると、フォームに自動入力されます
                                    </p>
                                </div>

                                {/* オファーモードでは募集人数は1名固定で非表示 */}
                                {!isOfferMode && (
                                    <div className="w-32">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            募集人数 <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.recruitmentCount}
                                            onChange={(e) => handleInputChange('recruitmentCount', Number(e.target.value))}
                                            className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${showErrors && (!formData.recruitmentCount || formData.recruitmentCount <= 0) ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                        >
                                            {Array.from({ length: 30 }, (_, i) => i + 1).map(num => (
                                                <option key={num} value={num}>{num}人</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* 求人種別選択 + マッチング方法（オファーモード時は非表示） - 左右2カラム */}
                            {!isOfferMode && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* 左側：求人種別選択 */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    求人種別 <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={formData.jobType}
                                                    onChange={(e) => {
                                                        const newJobType = e.target.value as JobTypeValue;
                                                        handleInputChange('jobType', newJobType);

                                                        // 限定求人に変更した場合、切り替え日数を7日に初期化
                                                        if (newJobType === 'LIMITED_WORKED' || newJobType === 'LIMITED_FAVORITE') {
                                                            setFormData(prev => ({ ...prev, jobType: newJobType, switchToNormalDaysBefore: 7 }));
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                >
                                                    {JOB_TYPE_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {JOB_TYPE_OPTIONS.find(opt => opt.value === formData.jobType)?.description || ''}
                                                </p>
                                            </div>

                                            {/* 限定求人で対象者0人の場合の警告メッセージ */}
                                            {formData.jobType === 'LIMITED_WORKED' && limitedJobTargetCounts.workedCount === 0 && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs text-amber-700">
                                                        対象ワーカーがいないため選択できません
                                                    </p>
                                                </div>
                                            )}
                                            {formData.jobType === 'LIMITED_FAVORITE' && limitedJobTargetCounts.favoriteCount === 0 && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs text-amber-700">
                                                        お気に入りワーカーがいないため選択できません
                                                    </p>
                                                </div>
                                            )}

                                            {/* 限定求人：通常求人への自動切り替え設定 */}
                                            {(formData.jobType === 'LIMITED_WORKED' || formData.jobType === 'LIMITED_FAVORITE') && (
                                                <div ref={switchSettingRef} className="bg-white border border-gray-200 rounded-lg p-2">
                                                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                                        <span className="text-gray-700">勤務開始日の</span>
                                                        <select
                                                            value={formData.switchToNormalDaysBefore ?? 7}
                                                            onChange={(e) => handleInputChange('switchToNormalDaysBefore', parseInt(e.target.value))}
                                                            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                        >
                                                            {SWITCH_TO_NORMAL_OPTIONS.map((opt) => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                        <span className="text-gray-700">に通常求人に切り替え</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 右側：審査してマッチング（説明会の場合はグレーアウト） */}
                                        <div className={`flex items-start md:border-l md:border-blue-200 md:pl-4 ${formData.jobType === 'ORIENTATION' ? 'opacity-50' : ''}`}>
                                            <label className={`flex items-start gap-3 ${formData.jobType === 'ORIENTATION' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.jobType === 'ORIENTATION' ? false : formData.requiresInterview}
                                                    onChange={(e) => handleInputChange('requiresInterview', e.target.checked)}
                                                    disabled={formData.jobType === 'ORIENTATION'}
                                                    className={`mt-0.5 w-5 h-5 border-gray-300 rounded focus:ring-blue-500 ${formData.jobType === 'ORIENTATION' ? 'bg-gray-200 text-gray-400' : 'text-blue-600'}`}
                                                />
                                                <div>
                                                    <span className={`text-sm font-medium ${formData.jobType === 'ORIENTATION' ? 'text-gray-400' : 'text-gray-900'}`}>審査してからマッチング</span>
                                                    <p className={`text-xs mt-1 ${formData.jobType === 'ORIENTATION' ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {formData.jobType === 'ORIENTATION' ? (
                                                            '説明会では審査は行いません'
                                                        ) : (
                                                            <>
                                                                応募後に審査・選考を行います<br />
                                                                <span className="text-red-500 font-bold">※OFFの方がマッチング率UP</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3行目：求人タイトル */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    求人タイトル <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${showErrors && !formData.title?.trim() ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    placeholder="例:デイサービス・介護スタッフ募集（日勤）"
                                />
                                {showErrors && !formData.title?.trim() && (
                                    <p className="text-red-500 text-xs mt-1">求人タイトルを入力してください</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    TOP画像登録（3枚まで） <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-500 mb-2">推奨画像サイズ: 1200×800px（比率 3:2）</p>
                                <p className="text-xs text-gray-500 mb-3">登録できるファイルサイズは10MBまでです</p>
                                <div className="space-y-2">
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
                                                const files = Array.from(e.dataTransfer.files);
                                                handleImageUpload({ new: 'images', existing: 'existingImages' }, files);
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
                                                onChange={(e) => handleImageUpload({ new: 'images', existing: 'existingImages' }, e)}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* 既存画像 */}
                                        {formData.existingImages.map((url, index) => (
                                            <div key={`existing-${index}`} className="relative">
                                                <img
                                                    src={url}
                                                    alt={`既存画像 ${index + 1}`}
                                                    className={`w-full h-24 object-cover rounded ${index === 0 ? 'border-2 border-orange-400' : 'border-2 border-blue-200'}`}
                                                />
                                                <button
                                                    onClick={() => removeExistingImage(index)}
                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                {index === 0 && (
                                                    <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded">
                                                        TOP
                                                    </span>
                                                )}
                                                <span className="absolute bottom-1 left-1 px-1 py-0.5 text-[10px] bg-blue-500 text-white rounded">
                                                    テンプレート
                                                </span>
                                            </div>
                                        ))}
                                        {/* 新規画像 */}
                                        {formData.images.map((file, index) => {
                                            const isTop = formData.existingImages.length === 0 && index === 0;
                                            return (
                                                <div key={`new-${index}`} className="relative">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt={`Upload ${index + 1}`}
                                                        className={`w-full h-24 object-cover rounded ${isTop ? 'border-2 border-orange-400' : ''}`}
                                                    />
                                                    <button
                                                        onClick={() => removeImage(index)}
                                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    {isTop && (
                                                        <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded">
                                                            TOP
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 勤務日選択カレンダー */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            勤務日選択 <span className="text-red-500">*</span>
                        </h2>
                        <p className="text-sm text-gray-600 mb-4">
                            選択した日付で、この条件の求人が作成されます。複数選択すると、1つの求人に複数の勤務日が設定されます。または「日付を選ばずに募集」を選択してください。
                        </p>

                        <div className="flex gap-4">
                            {/* カレンダー */}
                            <div className="w-[280px] flex-shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <button
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <h3 className="text-sm font-semibold">
                                        {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                                    </h3>
                                    <button
                                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 gap-0.5">
                                    {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                                        <div key={day} className={`text-center text-[10px] font-semibold py-0.5 ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                                            {day}
                                        </div>
                                    ))}
                                    {(() => {
                                        // Helper for calendar
                                        const getDaysInMonth = (date: Date) => {
                                            const year = date.getFullYear();
                                            const month = date.getMonth();
                                            const firstDay = new Date(year, month, 1);
                                            const lastDay = new Date(year, month + 1, 0);
                                            return { daysInMonth: lastDay.getDate(), startingDayOfWeek: firstDay.getDay(), year, month };
                                        };
                                        const formatDate = (year: number, month: number, day: number) => {
                                            return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        };

                                        const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                                        const today = getCurrentTime();
                                        today.setHours(0, 0, 0, 0);
                                        const days = [];

                                        // 空白セル
                                        for (let i = 0; i < startingDayOfWeek; i++) {
                                            days.push(<div key={`empty-${i}`} className="aspect-square" />);
                                        }

                                        // 日付セル
                                        for (let day = 1; day <= daysInMonth; day++) {
                                            const dateString = formatDate(year, month, day);
                                            const currentDate = new Date(year, month, day);
                                            const isPast = currentDate < today;
                                            // 選択状態判定
                                            const isSelected = mode === 'create'
                                                ? selectedDates.includes(dateString)
                                                : existingWorkDates.some(wd => wd.date === dateString && !removedWorkDateIds.includes(wd.id)) || addedWorkDates.includes(dateString);

                                            const dayOfWeek = currentDate.getDay();

                                            days.push(
                                                <button
                                                    key={day}
                                                    onClick={() => !isPast && handleDateClick(dateString)}
                                                    disabled={isPast}
                                                    className={`aspect-square flex items-center justify-center text-[10px] rounded transition-colors ${isPast
                                                        ? 'text-gray-300 cursor-not-allowed'
                                                        : isSelected
                                                            ? 'bg-blue-600 text-white font-semibold'
                                                            : dayOfWeek === 0
                                                                ? 'text-red-500 hover:bg-red-50'
                                                                : dayOfWeek === 6
                                                                    ? 'text-blue-500 hover:bg-blue-50'
                                                                    : 'text-gray-700 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        }
                                        return days;
                                    })()}
                                </div>

                                <div className="mt-1.5 text-[10px] text-gray-500">
                                    <p>• クリックで日付選択/解除 • 複数選択可能 • 過去の日付は選択不可</p>
                                </div>

                                {/* この月全てを選択チェックボックス */}
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                const getDaysInMonth = (date: Date) => {
                                                    const year = date.getFullYear();
                                                    const month = date.getMonth();
                                                    const lastDay = new Date(year, month + 1, 0);
                                                    return { daysInMonth: lastDay.getDate(), year, month };
                                                };
                                                const formatDate = (year: number, month: number, day: number) => {
                                                    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                };
                                                const { daysInMonth, year, month } = getDaysInMonth(currentMonth);
                                                const today = getCurrentTime();
                                                today.setHours(0, 0, 0, 0);
                                                let selectableDates: string[] = [];
                                                for (let day = 1; day <= daysInMonth; day++) {
                                                    const currentDate = new Date(year, month, day);
                                                    if (currentDate >= today) {
                                                        selectableDates.push(formatDate(year, month, day));
                                                    }
                                                }
                                                if (e.target.checked) {
                                                    // 選択可能な日付を全て追加（簡易実装: selectedDatesのみ更新。編集モードは別途対応必要だが、今回は作成モード優先で実装）
                                                    // 編集モードでの「全選択」は複雑になるため、ここではmode === 'create'のみ正しく動作することを想定
                                                    if (mode === 'create') {
                                                        const combined = [...selectedDates, ...selectableDates];
                                                        const newDates = Array.from(new Set(combined)).sort();
                                                        setSelectedDates(newDates);
                                                    } else {
                                                        // 編集モードでもaddedWorkDatesに追加するロジックが必要だが、ここでは一旦スキップまたは警告
                                                        toast('編集モードでの一括選択は現在サポートされていません', { icon: '⚠️' });
                                                    }
                                                } else {
                                                    if (mode === 'create') {
                                                        setSelectedDates(selectedDates.filter(d => !selectableDates.includes(d)));
                                                    }
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                                        />
                                        <span className="text-xs text-gray-700">この月全てを選択</span>
                                    </label>
                                </div>
                            </div>

                            {/* 選択された日付のプレビューカード */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                    選択された求人カード（{mode === 'create' ? selectedDates.length : existingWorkDates.length + addedWorkDates.length - removedWorkDateIds.length}件）
                                </h3>

                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {(mode === 'create' ? selectedDates : [...existingWorkDates.filter(wd => !removedWorkDateIds.includes(wd.id)).map(wd => wd.date), ...addedWorkDates]).map((date) => {
                                        const dateObj = new Date(date);
                                        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                                        const index = dateObj.getDay();
                                        const dateColor = index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-900';

                                        return (
                                            <div key={date} className="bg-gray-50 border border-gray-200 rounded p-2 relative flex items-center">
                                                <div className={`text-xs font-semibold ${dateColor} pr-6 leading-tight`}>
                                                    {dateObj.getFullYear()}/{dateObj.getMonth() + 1}/{dateObj.getDate()}（{dayOfWeek}）
                                                </div>
                                                <button
                                                    onClick={() => handleDateClick(date)}
                                                    className="absolute top-1/2 -translate-y-1/2 right-2 p-0.5 hover:bg-white rounded transition-colors"
                                                    title="削除"
                                                >
                                                    <X className="w-3 h-3 text-gray-500" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 勤務日条件チェックボックス */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">勤務日条件</h3>

                                <div className="space-y-2">
                                    {[2, 3, 4, 5].map(freq => (
                                        <label key={freq} className="flex items-start gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={recruitmentOptions.weeklyFrequency === freq}
                                                onChange={() => handleRecruitmentOptionChange(freq)}
                                                className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-40"
                                            />
                                            <span className="text-sm text-gray-700">
                                                {freq}回以上勤務できる人を募集
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                {/* 勤務日条件の注意文 */}
                                {recruitmentOptions.weeklyFrequency && (
                                    <div className="mt-2 space-y-1">
                                        <p className="text-xs text-amber-600">
                                            ※ワーカーから{recruitmentOptions.weeklyFrequency}回未満の応募ができなくなります
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            ※日付経過などで指定回数を下回った場合は、自動で単発求人に切り替わります
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 勤務時間 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">勤務時間</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        開始時刻 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-1">
                                        <select
                                            value={formData.startTime.split(':')[0]}
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

                            <div className="grid grid-cols-4 gap-4">
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

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        募集開始時間 <span className="text-red-500">*</span>
                                    </label>
                                    {formData.recruitmentStartDay === 0 || formData.recruitmentStartDay === -1 ? (
                                        <input
                                            type="text"
                                            value="--:--"
                                            readOnly
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100 text-gray-500"
                                        />
                                    ) : (
                                        <input
                                            type="time"
                                            value={formData.recruitmentStartTime}
                                            onChange={(e) => handleInputChange('recruitmentStartTime', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    )}
                                </div>

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

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        募集終了時間 <span className="text-red-500">*</span>
                                    </label>
                                    {formData.recruitmentEndDay === 0 || formData.recruitmentEndDay === -1 ? (
                                        <input
                                            type="text"
                                            value="--:--"
                                            readOnly
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100 text-gray-500"
                                        />
                                    ) : (
                                        <input
                                            type="time"
                                            value={formData.recruitmentEndTime}
                                            onChange={(e) => handleInputChange('recruitmentEndTime', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 給与 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
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
                                    className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                        isBelowMinimumWage || (showErrors && (!formData.hourlyWage || formData.hourlyWage <= 0))
                                            ? 'border-red-500 bg-red-50'
                                            : 'border-gray-300'
                                    }`}
                                    placeholder="例: 1200"
                                />
                                {formData.hourlyWage > 0 && !isBelowMinimumWage && (
                                    <p className="text-blue-600 text-xs mt-1">¥{formData.hourlyWage.toLocaleString()}</p>
                                )}
                                {isBelowMinimumWage && (
                                    <div className="mt-1">
                                        <p className="text-red-500 text-xs">
                                            {facilityInfo?.prefecture}の最低賃金（{minimumWage!.toLocaleString()}円）を下回っています
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => handleInputChange('hourlyWage', minimumWage!)}
                                            className="text-blue-600 text-xs mt-1 underline hover:text-blue-800"
                                        >
                                            最低賃金を適用（{minimumWage!.toLocaleString()}円）
                                        </button>
                                    </div>
                                )}
                                {!isBelowMinimumWage && minimumWage !== null && facilityInfo?.prefecture && (
                                    <p className="text-gray-500 text-xs mt-1">
                                        ※ {facilityInfo.prefecture}の最低賃金: {minimumWage.toLocaleString()}円
                                    </p>
                                )}
                                {showErrors && (!formData.hourlyWage || formData.hourlyWage <= 0) && (
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
                                    {filteredTransportationFeeOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                {workingMinutes > 0 && minTransportationFee > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {minTransportationFee >= TRANSPORTATION_FEE_MAX
                                            ? `※ 実働${formatWorkingHours(workingHours)}の場合、交通費は上限の${TRANSPORTATION_FEE_MAX.toLocaleString()}円となります`
                                            : `※ 実働${formatWorkingHours(workingHours)}の場合、最低${minTransportationFee}円以上`
                                        }
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    日給（総支払）
                                </label>
                                <input
                                    type="text"
                                    value={dailyWage.toLocaleString()}
                                    readOnly
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 業務設定 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">業務設定</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    仕事内容（複数選択可） <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-4 gap-2 p-3 border border-gray-200 rounded">
                                    {WORK_CONTENT_OPTIONS.map(option => (
                                        <label key={option} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
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
                            </div>

                            {requiresGenderSpecification && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        性別指定 <span className="text-red-500">*</span>
                                    </label>
                                    <p className="text-xs text-gray-500 mb-2">入浴介助または排泄介助を選択した場合のみ指定が必要です</p>
                                    <select
                                        value={formData.genderRequirement}
                                        onChange={(e) => handleInputChange('genderRequirement', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        <option value="">指定なし</option>
                                        <option value="male">男性</option>
                                        <option value="female">女性</option>
                                    </select>
                                </div>
                            )}

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

                    {/* 条件設定 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">条件設定</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    資格条件（複数選択可） <span className="text-red-500">*</span>
                                </label>
                                <div className={`border rounded p-4 ${showErrors && formData.qualifications.length === 0 ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                    {showErrors && formData.qualifications.length === 0 && (
                                        <p className="text-red-500 text-xs mb-3">少なくとも1つの資格を選択してください</p>
                                    )}
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

                                    {/* 無資格可オプション */}
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
                                                // 簡易アップロード
                                                if (files.length > 0) {
                                                    const dummyEvent = { target: { files: files } } as any;
                                                    handleDresscodeImageUpload(dummyEvent);
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
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* 既存服装画像 */}
                                        {formData.existingDresscodeImages.map((url, index) => (
                                            <div key={`existing-dresscode-${index}`} className="relative">
                                                <img
                                                    src={url}
                                                    alt={`既存服装サンプル ${index + 1}`}
                                                    className="w-full h-24 object-cover rounded border-2 border-blue-200"
                                                />
                                                <button
                                                    onClick={() => removeExistingDresscodeImage(index)}
                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <span className="absolute bottom-1 left-1 px-1 py-0.5 text-[10px] bg-blue-500 text-white rounded">
                                                    テンプレート
                                                </span>
                                            </div>
                                        ))}
                                        {/* 新規服装画像 */}
                                        {formData.dresscodeImages.map((file, index) => (
                                            <div key={`new-dresscode-${index}`} className="relative">
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

                    {/* その他 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">その他</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    アイコン <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-blue-600 mb-2">チェックが多いほどより多くのワーカーから応募がきます!</p>
                                <div className="grid grid-cols-3 gap-2">
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
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    その他添付文章（3つまで）
                                </label>
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
                                                // 簡易アップロード
                                                if (files.length > 0) {
                                                    const dummyEvent = { target: { files: files } } as any;
                                                    handleAttachmentUpload(dummyEvent);
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
                                    <div className="space-y-2">
                                        {/* 既存添付ファイル */}
                                        {formData.existingAttachments.map((url, index) => {
                                            const fileName = url.split('/').pop() || 'ファイル';
                                            return (
                                                <div key={`existing-attachment-${index}`} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {fileName}
                                                    </a>
                                                    <button
                                                        onClick={() => removeExistingAttachment(index)}
                                                        className="p-1 text-red-500 hover:text-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {/* 新規添付ファイル */}
                                        {formData.attachments.map((file, index) => (
                                            <div key={`new-attachment-${index}`} className="flex items-center justify-between p-2 border border-gray-200 rounded">
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

                    {/* オファーメッセージ（オファーモード時のみ表示） */}
                    {isOfferMode && (
                        <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 mt-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="text-blue-500">✉️</span>
                                オファーメッセージ
                            </h2>
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">
                                    {offerTargetWorker?.name}さんへのメッセージを入力してください（任意）
                                </p>

                                {/* テンプレート選択UI */}
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedOfferTemplateId || ''}
                                        onChange={(e) => {
                                            const templateId = e.target.value ? Number(e.target.value) : null;
                                            setSelectedOfferTemplateId(templateId);
                                            if (templateId) {
                                                const template = offerTemplates.find(t => t.id === templateId);
                                                if (template) {
                                                    handleInputChange('offerMessage', template.message);
                                                }
                                            }
                                        }}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">テンプレートから選択</option>
                                        {offerTemplates.map(template => (
                                            <option key={template.id} value={template.id}>
                                                {template.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowOfferTemplateModal(true)}
                                        className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        <FileText className="w-4 h-4" />
                                        編集
                                    </button>
                                </div>

                                <textarea
                                    value={formData.offerMessage || ''}
                                    onChange={(e) => handleInputChange('offerMessage', e.target.value)}
                                    rows={4}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="例：いつもご勤務ありがとうございます。ぜひまたお願いしたいと思いオファーを送らせていただきました。ご検討よろしくお願いいたします。"
                                />
                                <p className="text-xs text-gray-500">
                                    ※このメッセージは求人情報と一緒にワーカーへ送信されます
                                </p>
                            </div>
                        </div>
                    )}

                    {/* オファーテンプレート管理モーダル */}
                    {showOfferTemplateModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                    <h3 className="text-lg font-bold">オファーメッセージテンプレート管理</h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowOfferTemplateModal(false);
                                            setEditingOfferTemplate(null);
                                            setIsCreatingOfferTemplate(false);
                                            setNewOfferTemplateName('');
                                            setNewOfferTemplateMessage('');
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-4 overflow-y-auto max-h-[60vh]">
                                    {/* 新規作成 / 編集フォーム */}
                                    {(isCreatingOfferTemplate || editingOfferTemplate) && (
                                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-medium mb-3">
                                                {editingOfferTemplate ? 'テンプレートを編集' : '新規テンプレート作成'}
                                            </h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        テンプレート名
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newOfferTemplateName}
                                                        onChange={(e) => setNewOfferTemplateName(e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="例：リピーター向けオファー"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        メッセージ内容
                                                    </label>
                                                    <textarea
                                                        value={newOfferTemplateMessage}
                                                        onChange={(e) => setNewOfferTemplateMessage(e.target.value)}
                                                        rows={4}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="オファーメッセージの内容を入力..."
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={editingOfferTemplate ? handleUpdateOfferTemplate : handleCreateOfferTemplate}
                                                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                                    >
                                                        {editingOfferTemplate ? '更新する' : '作成する'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingOfferTemplate(null);
                                                            setIsCreatingOfferTemplate(false);
                                                            setNewOfferTemplateName('');
                                                            setNewOfferTemplateMessage('');
                                                        }}
                                                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                    >
                                                        キャンセル
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* テンプレート一覧 */}
                                    {!isCreatingOfferTemplate && !editingOfferTemplate && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCreatingOfferTemplate(true);
                                                // 現在入力中のメッセージがあればテンプレート作成フォームにデフォルトセット
                                                if (formData.offerMessage?.trim()) {
                                                    setNewOfferTemplateMessage(formData.offerMessage.trim());
                                                }
                                            }}
                                            className="mb-4 flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                                        >
                                            <Plus className="w-4 h-4" />
                                            新規テンプレート作成
                                        </button>
                                    )}

                                    {offerTemplates.length === 0 && !isCreatingOfferTemplate && (
                                        <p className="text-sm text-gray-500 text-center py-8">
                                            テンプレートがありません。新規作成してください。
                                        </p>
                                    )}

                                    <div className="space-y-3">
                                        {offerTemplates.map(template => (
                                            <div
                                                key={template.id}
                                                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h5 className="font-medium text-gray-900">{template.name}</h5>
                                                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                                                            {template.message}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingOfferTemplate(template);
                                                                setNewOfferTemplateName(template.name);
                                                                setNewOfferTemplateMessage(template.message);
                                                            }}
                                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteOfferTemplate(template.id)}
                                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowOfferTemplateModal(false);
                                            setEditingOfferTemplate(null);
                                            setIsCreatingOfferTemplate(false);
                                            setNewOfferTemplateName('');
                                            setNewOfferTemplateMessage('');
                                        }}
                                        className="w-full py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        閉じる
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 確認モーダル */}
            <JobConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={() => {
                    setShowConfirm(false);
                    handleSave();
                }}
                onOpenPreview={() => setShowPreview(true)}
                selectedDatesCount={selectedDates.length}
                isSubmitting={isSaving}
            />

            {/* プレビューモーダル */}
            {
                showPreview && (
                    <JobPreviewModal
                        isOpen={showPreview}
                        onClose={() => setShowPreview(false)}
                        jobData={{
                            ...formData,
                            selectedDates: mode === 'create' ? selectedDates : existingWorkDates.map(d => d.date),
                            images: previewImages.length > 0 ? previewImages : (formData.images.map(f => URL.createObjectURL(f)).concat(formData.existingImages)),
                            // Note: previewImages in state might be empty if we didn't implement logic to populate it.
                            // JobPreviewModal expects specific format.
                            // For now passing formData.
                            dresscodeImages: formData.dresscodeImages.map(f => URL.createObjectURL(f)).concat(formData.existingDresscodeImages),
                            attachments: [],
                        }}
                        facilityData={{
                            id: facilityInfo?.id || 0,
                            facilityName: facilityInfo?.facilityName || '',
                            address: facilityInfo?.address || '',
                            prefecture: facilityInfo?.prefecture || '',
                            city: facilityInfo?.city || '',
                            mapImage: facilityInfo?.mapImage || null,
                            managerName: facilityInfo?.staffSameAsManager
                                ? (facilityInfo.managerLastName && facilityInfo.managerFirstName ? `${facilityInfo.managerLastName} ${facilityInfo.managerFirstName}` : '担当者')
                                : (facilityInfo?.staffLastName && facilityInfo?.staffFirstName ? `${facilityInfo.staffLastName} ${facilityInfo.staffFirstName}` : '担当者'),
                            managerPhoto: facilityInfo?.staffPhoto || null,
                            managerGreeting: facilityInfo?.staffGreeting || null,
                        }}
                    />
                )
            }
        </div>
    );
}
