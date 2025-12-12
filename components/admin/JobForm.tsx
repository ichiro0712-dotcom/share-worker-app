'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, X, ArrowLeft, Loader2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import AddressSelector from '@/components/ui/AddressSelector';
import { JobConfirmModal } from '@/components/admin/JobConfirmModal';
import { JobPreviewModal } from '@/components/admin/JobPreviewModal';
import { calculateDailyWage } from '@/utils/salary';
import { validateImageFiles, validateAttachmentFiles } from '@/utils/fileValidation';
import { createJobs, updateJob, getAdminJobTemplates, getFacilityInfo, getJobById } from '@/src/lib/actions';
import { getSystemTemplates, getJobDescriptionFormats, getDismissalReasonsFromLaborTemplate } from '@/src/lib/content-actions';
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
    WORK_FREQUENCY_ICONS,
    MONTHLY_COMMITMENT_ICON,
} from '@/constants';
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
}

interface ExistingWorkDate {
    id: number;
    date: string;
    recruitmentCount: number;
    appliedCount: number;
}

interface JobFormProps {
    mode: 'create' | 'edit';
    jobId?: string;
}

export default function JobForm({ mode, jobId }: JobFormProps) {
    const router = useRouter();
    const { admin, isAdmin, isAdminLoading } = useAuth();

    // === 共通 State ===
    const [isLoading, setIsLoading] = useState(mode === 'edit');
    const [isSaving, setIsSaving] = useState(false);
    const [jobTemplates, setJobTemplates] = useState<TemplateData[]>([]);
    const [facilityInfo, setFacilityInfo] = useState<FacilityData | null>(null);
    const [jobDescriptionFormats, setJobDescriptionFormats] = useState<{ id: number; label: string; content: string }[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // プレビュー用
    const [showPreview, setShowPreview] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewDresscodeImages, setPreviewDresscodeImages] = useState<string[]>([]);

    // 新規作成用 State
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);

    // 編集用 State
    const [existingWorkDates, setExistingWorkDates] = useState<ExistingWorkDate[]>([]);
    const [addedWorkDates, setAddedWorkDates] = useState<string[]>([]);
    const [removedWorkDateIds, setRemovedWorkDateIds] = useState<number[]>([]);

    // 入力用一時 State
    const [skillInput, setSkillInput] = useState('');
    const [dresscodeInput, setDresscodeInput] = useState('');
    const [belongingInput, setBelongingInput] = useState('');

    // 募集条件設定
    const [recruitmentOptions, setRecruitmentOptions] = useState({
        noDateSelection: false,
        weeklyFrequency: null as 2 | 3 | 4 | null,
        monthlyCommitment: false,
    });

    // フォームデータ
    const [formData, setFormData] = useState({
        facilityId: null as number | null,
        jobType: '単発',
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
        // 新規作成用
        recruitmentStartDay: 0,
        recruitmentStartTime: '',
        recruitmentEndDay: 1,
        recruitmentEndTime: '12:00',
        // 共通
        genderRequirement: '不問',
        dismissalReasons: '',
        requiresInterview: false,
        // 住所情報
        postalCode: '',
        prefecture: '',
        city: '',
        addressLine: '',
        building: '',
        address: '',
    });

    // === 初期データ取得 ===
    useEffect(() => {
        if (isAdminLoading) return;
        if (!isAdmin || !admin) {
            router.push('/admin/login');
            return;
        }

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
                    setIsLoading(false);
                }

            } catch (error) {
                console.error('Failed to load initial data:', error);
                toast.error('データの読み込みに失敗しました');
                setIsLoading(false);
            }
        };

        loadData();
    }, [isAdmin, admin, isAdminLoading, router, mode, jobId]);

    // 編集モードデータの取得
    const fetchEditData = async (id: string, facility: any, defaultDismissalReasons: string) => {
        try {
            const jobData = await getJobById(id);

            if (!jobData) {
                toast.error('求人が見つかりません');
                router.push('/admin/jobs');
                return;
            }

            if (jobData.facility_id !== admin?.facilityId) {
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
            let weeklyFreq: 2 | 3 | 4 | null = null;
            for (const [freq, icon] of Object.entries(WORK_FREQUENCY_ICONS)) {
                if (existingTags.includes(icon)) {
                    weeklyFreq = parseInt(freq) as 2 | 3 | 4;
                    break;
                }
            }
            const monthlyCommit = existingTags.includes(MONTHLY_COMMITMENT_ICON);

            setRecruitmentOptions({
                noDateSelection: false,
                weeklyFrequency: (jobData.weekly_frequency ?? weeklyFreq) as 2 | 3 | 4 | null,
                monthlyCommitment: jobData.monthly_commitment ?? monthlyCommit,
            });

            // フォームデータ設定
            setFormData(prev => ({
                ...prev,
                facilityId: jobData.facility_id,
                title: jobData.title || '',
                jobType: '単発', // 現状固定
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
                // 住所
                prefecture: jobData.prefecture || facility?.prefecture || '',
                city: jobData.city || facility?.city || '',
                addressLine: jobData.address_line || facility?.addressLine || '',
                building: '', // DBにないので空
                address: jobData.address || facility?.address || '',
            }));

        } catch (error) {
            console.error('Failed to fetch edit data:', error);
            toast.error('求人データの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    // === ハンドラー ===

    const handleInputChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
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
                const frequencyValue = parseInt(frequencyEntry[0]) as 2 | 3 | 4;
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

            if (item === MONTHLY_COMMITMENT_ICON) {
                setRecruitmentOptions(prev => ({
                    ...prev,
                    monthlyCommitment: !isRemoving,
                }));
            }
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

    // カレンダー操作
    const handleDateClick = (dateString: string) => {
        if (mode === 'create') {
            if (selectedDates.includes(dateString)) {
                setSelectedDates(selectedDates.filter(d => d !== dateString));
            } else {
                setSelectedDates([...selectedDates, dateString].sort());
            }
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
        let weeklyFrequency: 2 | 3 | 4 | null = null;
        for (const [freq, icon] of Object.entries(WORK_FREQUENCY_ICONS)) {
            if (templateTags.includes(icon)) weeklyFrequency = parseInt(freq) as 2 | 3 | 4;
        }
        const monthlyCommitment = templateTags.includes(MONTHLY_COMMITMENT_ICON);

        setRecruitmentOptions({
            noDateSelection: false,
            weeklyFrequency,
            monthlyCommitment
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

    const handleRecruitmentOptionChange = (option: 'noDateSelection' | 'weeklyFrequency' | 'monthlyCommitment', value: boolean | number) => {
        if (option === 'noDateSelection') {
            setRecruitmentOptions(prev => ({
                ...prev,
                noDateSelection: value as boolean,
                weeklyFrequency: value ? null : prev.weeklyFrequency,
                monthlyCommitment: value ? false : prev.monthlyCommitment
            }));
            if (value) {
                setSelectedDates([]);
                const removeIcons = [...Object.values(WORK_FREQUENCY_ICONS), MONTHLY_COMMITMENT_ICON];
                handleInputChange('icons', formData.icons.filter(i => !removeIcons.includes(i)));
            }
        } else if (option === 'weeklyFrequency') {
            const val = value as 2 | 3 | 4;
            const newValue = recruitmentOptions.weeklyFrequency === val ? null : val;
            setRecruitmentOptions(prev => ({ ...prev, weeklyFrequency: newValue }));

            const newIcon = newValue ? WORK_FREQUENCY_ICONS[newValue as keyof typeof WORK_FREQUENCY_ICONS] : null;
            const removeIcons = Object.values(WORK_FREQUENCY_ICONS);
            let newIcons = formData.icons.filter(i => !removeIcons.includes(i as any));
            if (newIcon) newIcons.push(newIcon);
            handleInputChange('icons', newIcons);

        } else if (option === 'monthlyCommitment') {
            const val = value as boolean;
            setRecruitmentOptions(prev => ({ ...prev, monthlyCommitment: val }));

            let newIcons = formData.icons.filter(i => i !== MONTHLY_COMMITMENT_ICON);
            if (val) newIcons.push(MONTHLY_COMMITMENT_ICON);
            handleInputChange('icons', newIcons);
        }
    };

    // 確認・保存
    const handleShowConfirm = () => {
        // 簡易バリデーション
        if (!formData.title) return toast.error('タイトルは必須です');
        if (mode === 'create' && selectedDates.length === 0 && !recruitmentOptions.noDateSelection) {
            return toast.error('勤務日を選択してください');
        }
        if (!formData.startTime || !formData.endTime) return toast.error('勤務時間は必須です');

        setShowConfirm(true);
    };

    const handlePreview = () => {
        const newUrls = formData.images.map(f => URL.createObjectURL(f));
        const newDresscodeUrls = formData.dresscodeImages.map(f => URL.createObjectURL(f));
        setPreviewImages([...formData.existingImages, ...newUrls]);
        setPreviewDresscodeImages([...formData.existingDresscodeImages, ...newDresscodeUrls]);
        setShowPreview(true);
    };

    const handleSave = async () => {
        if (isSaving) return;

        // 編集モードのバリデーション
        if (mode === 'edit') {
            const activeDatesCount = existingWorkDates.filter(d => !removedWorkDateIds.includes(d.id)).length + addedWorkDates.length;
            if (activeDatesCount === 0) return toast.error('勤務日は少なくとも1つ必要です');
        }

        setIsSaving(true);
        try {
            // 画像等のアップロード
            const uploadFiles = async (files: File[], apiConfig: string) => {
                if (files.length === 0) return [];
                const fd = new FormData();
                files.forEach(f => fd.append('files', f));
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('Upload failed');
                const json = await res.json();
                return json.urls || [];
            };

            const newImageUrls = await uploadFiles(formData.images, '');
            const newDressUrls = await uploadFiles(formData.dresscodeImages, '');
            const newAttachUrls = await uploadFiles(formData.attachments, '');

            const finalImages = [...formData.existingImages, ...newImageUrls];
            const finalDress = [...formData.existingDresscodeImages, ...newDressUrls];
            const finalAttach = [...formData.existingAttachments, ...newAttachUrls];

            if (mode === 'create') {
                // 新規作成
                let workDates = selectedDates;
                if (recruitmentOptions.noDateSelection) {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    workDates = [d.toISOString().split('T')[0]];
                }

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
                    monthlyCommitment: recruitmentOptions.monthlyCommitment,
                    requiresInterview: formData.requiresInterview,
                    prefecture: formData.prefecture,
                    city: formData.city,
                    addressLine: formData.addressLine,
                    address: formData.address,
                });

                if (res.success) {
                    toast.success('求人を作成しました');
                    router.push('/admin/jobs');
                } else {
                    toast.error(res.error || '作成失敗');
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
                });

                if (res.success) {
                    toast.success('求人を更新しました');
                    router.push('/admin/jobs');
                } else {
                    toast.error(res.error || '更新失敗');
                }
            }

        } catch (e) {
            console.error(e);
            toast.error('保存中にエラーが発生しました');
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
            {/* Header */}
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
                            onClick={handlePreview}
                            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                        >
                            プレビュー
                        </button>
                        {mode === 'create' ? (
                            <button
                                onClick={handleShowConfirm}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
                            >
                                {isSaving ? '保存中...' : '公開する'}
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
                            >
                                {isSaving ? '保存中...' : '更新する'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Form */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* 1. 基本セクション */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">基本</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">施設</label>
                                    <input type="text" value={facilityInfo?.facilityName || ''} readOnly className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">求人種別 <span className="text-red-500">*</span></label>
                                    <select
                                        value={formData.jobType}
                                        onChange={(e) => handleInputChange('jobType', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                                    >
                                        {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">募集人数 <span className="text-red-500">*</span></label>
                                    <select
                                        value={formData.recruitmentCount}
                                        onChange={(e) => handleInputChange('recruitmentCount', Number(e.target.value))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                                    >
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}人</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* テンプレート選択 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">テンプレート（任意）</label>
                                <select
                                    value={selectedTemplateId || ''}
                                    onChange={(e) => handleTemplateSelect(Number(e.target.value))}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                                >
                                    <option value="">テンプレートを選択</option>
                                    {jobTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 2. カレンダーセクション */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-900">勤務日選択</h2>
                            {mode === 'create' && (
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={recruitmentOptions.noDateSelection}
                                            onChange={(e) => handleRecruitmentOptionChange('noDateSelection', e.target.checked)}
                                            className="rounded text-blue-600"
                                        />
                                        <span className="text-sm font-medium">日付を選ばずに募集</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* カレンダー本体 */}
                        {!recruitmentOptions.noDateSelection && (
                            <div className="border rounded-lg p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-1 hover:bg-gray-100 rounded">
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <span className="text-lg font-bold">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</span>
                                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-1 hover:bg-gray-100 rounded">
                                        <ArrowLeft className="w-5 h-5 rotate-180" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                                        <div key={d} className={`text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{d}</div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7 gap-1">
                                    {(() => {
                                        const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                                        const days = [];
                                        for (let i = 0; i < startingDayOfWeek; i++) {
                                            days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 rounded" />);
                                        }
                                        for (let day = 1; day <= daysInMonth; day++) {
                                            const dateStr = formatDate(year, month, day);
                                            let isSelected = false;
                                            let status = 'none';

                                            if (mode === 'create') {
                                                isSelected = selectedDates.includes(dateStr);
                                                status = isSelected ? 'selected' : 'none';
                                            } else {
                                                const existing = existingWorkDates.find(d => d.date === dateStr);
                                                const isAdded = addedWorkDates.includes(dateStr);
                                                const isRemoved = existing && removedWorkDateIds.includes(existing.id);

                                                if (isAdded) status = 'added';
                                                else if (isRemoved) status = 'removed';
                                                else if (existing) status = 'existing';
                                            }

                                            days.push(
                                                <div
                                                    key={dateStr}
                                                    onClick={() => handleDateClick(dateStr)}
                                                    className={`
                                    h-24 border rounded p-1 cursor-pointer transition-colors relative
                                    ${status === 'selected' || status === 'added' ? 'bg-blue-50 border-blue-500' : ''}
                                    ${status === 'existing' ? 'bg-green-50 border-green-500' : ''}
                                    ${status === 'removed' ? 'bg-red-50 border-red-300 opacity-60' : ''}
                                    ${status === 'none' ? 'hover:bg-gray-50' : ''}
                                 `}
                                                >
                                                    <div className="text-xs font-bold mb-1">{day}</div>
                                                    {status === 'existing' && (
                                                        <div className="text-xs text-green-700 bg-green-100 px-1 rounded">既存</div>
                                                    )}
                                                    {status === 'added' && (
                                                        <div className="text-xs text-blue-700 bg-blue-100 px-1 rounded">追加</div>
                                                    )}
                                                    {status === 'removed' && (
                                                        <div className="text-xs text-red-700 bg-red-100 px-1 rounded">削除</div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return days;
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. 勤務時間・給与・条件セクション（JobTemplateForm.tsxとほぼ同じなので簡略化実装） */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">詳細設定</h2>

                        {/* タイトル */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">求人タイトル <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="例：訪問介護スタッフ（未経験歓迎）" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">開始時間 <span className="text-red-500">*</span></label>
                                <select value={formData.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} className="w-full px-3 py-2 border rounded">
                                    {HOUR_OPTIONS.flatMap(h => MINUTE_OPTIONS.map(m => `${h}:${m}`)).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">終了時間 <span className="text-red-500">*</span></label>
                                <select value={formData.endTime} onChange={(e) => handleInputChange('endTime', e.target.value)} className="w-full px-3 py-2 border rounded">
                                    {END_HOUR_OPTIONS.flatMap(h => MINUTE_OPTIONS.map(m => `${h}:${m}`)).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">仕事内容 <span className="text-red-500">*</span></label>
                            <div className="grid grid-cols-2 gap-2">
                                {WORK_CONTENT_OPTIONS.map(opt => (
                                    <label key={opt} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.workContent.includes(opt)}
                                            onChange={() => toggleArrayItem('workContent', opt)}
                                            className="rounded"
                                        />
                                        <span className="text-sm">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">仕事詳細 <span className="text-red-500">*</span></label>
                                <button onClick={handleInsertTemplate} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded">テンプレート挿入</button>
                            </div>
                            <textarea
                                rows={6}
                                value={formData.jobDescription}
                                onChange={(e) => handleInputChange('jobDescription', e.target.value)}
                                className="w-full px-3 py-2 border rounded"
                            />
                        </div>

                        {/* 資格・スキル */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">資格条件 <span className="text-red-500">*</span></label>
                            <div className="border p-4 rounded bg-gray-50">
                                {QUALIFICATION_GROUPS.map(group => (
                                    <div key={group.name} className="mb-4">
                                        <h4 className="font-bold text-sm mb-2">{group.name}</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {group.qualifications.map(q => (
                                                <label key={q} className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.qualifications.includes(q)}
                                                        onChange={() => toggleArrayItem('qualifications', q)}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm">{q}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="mt-2 border-t pt-2">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" checked={formData.qualifications.includes('無資格可')} onChange={() => toggleArrayItem('qualifications', '無資格可')} />
                                        <span className="text-sm font-bold">無資格可</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. 画像・添付 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">画像・添付ファイル</h2>

                        {/* TOP画像 */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">TOP画像（最大3枚）</label>
                            <div className="space-y-2">
                                {(formData.images.length + formData.existingImages.length) < 3 && (
                                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                                        <div className="text-center">
                                            <Upload className="mx-auto h-8 w-8 text-gray-400" />
                                            <span className="text-sm text-gray-500">ドラッグ＆ドロップ または クリック</span>
                                        </div>
                                        <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload({ new: 'images', existing: 'existingImages' }, e)} />
                                    </label>
                                )}
                                <div className="grid grid-cols-3 gap-4">
                                    {formData.existingImages.map((url, i) => (
                                        <div key={`exist-${i}`} className="relative h-24">
                                            <img src={url} alt="existing" className="w-full h-full object-cover rounded" />
                                            <button onClick={() => removeFromArray('existingImages', i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                    {formData.images.map((file, i) => (
                                        <div key={`new-${i}`} className="relative h-24">
                                            <img src={URL.createObjectURL(file)} alt="new" className="w-full h-full object-cover rounded" />
                                            <button onClick={() => removeFromArray('images', i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* その他ファイル */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">添付資料 (PDF/Word/Excel等)</label>
                            <input type="file" multiple className="w-full text-sm" onChange={handleAttachmentUpload} />
                            <div className="mt-2 space-y-1">
                                {formData.existingAttachments.map((url, i) => (
                                    <div key={i} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                                        <span>{url.split('/').pop()}</span>
                                        <button onClick={() => removeFromArray('existingAttachments', i)} className="text-red-500 text-xs">削除</button>
                                    </div>
                                ))}
                                {formData.attachments.map((file, i) => (
                                    <div key={i} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                                        <span>{file.name}</span>
                                        <button onClick={() => removeFromArray('attachments', i)} className="text-red-500 text-xs">削除</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 5. 住所（編集時のみ） */}
                    {mode === 'edit' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">勤務地</h2>
                            <AddressSelector
                                postalCode={formData.postalCode}
                                prefecture={formData.prefecture}
                                city={formData.city}
                                addressLine={formData.addressLine}
                                building={formData.building}
                                onChange={values => setFormData(prev => ({ ...prev, ...values }))}
                            />
                        </div>
                    )}

                </div>
            </div>

            {/* Modals */}
            {showPreview && (
                <JobPreviewModal
                    isOpen={showPreview}
                    onClose={() => setShowPreview(false)}
                    jobData={{
                        ...formData,
                        selectedDates: mode === 'create' ? selectedDates : existingWorkDates.map(d => d.date),
                        images: previewImages,
                        dresscodeImages: previewDresscodeImages,
                        attachments: [], // Preview modal doesn't need actual attachment files for now
                    }}
                    facilityData={{
                        id: facilityInfo?.id || 0,
                        facilityName: facilityInfo?.facilityName || '',
                        address: facilityInfo?.address || '',
                        prefecture: facilityInfo?.prefecture || '',
                        city: facilityInfo?.city || '',
                    }}
                />
            )}

            {mode === 'create' && showConfirm && (
                <JobConfirmModal
                    isOpen={showConfirm}
                    onClose={() => setShowConfirm(false)}
                    onConfirm={handleSave}
                    onOpenPreview={handlePreview}
                    selectedDatesCount={selectedDates.length}
                    isSubmitting={isSaving}
                />
            )}

        </div>
    );
}
