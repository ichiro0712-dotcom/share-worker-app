'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, X, ChevronLeft, ChevronRight, Calendar, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import AddressSelector from '@/components/ui/AddressSelector';
import { JobPreviewModal } from '@/components/admin/JobPreviewModal';
import { calculateDailyWage } from '@/utils/salary';
import { validateImageFiles, validateAttachmentFiles } from '@/utils/fileValidation';
import { getJobById, updateJob, getFacilityInfo, getAdminJobTemplates } from '@/src/lib/actions';
import {
  JOB_TYPES,
  WORK_CONTENT_OPTIONS,
  QUALIFICATION_OPTIONS,
  ICON_OPTIONS,
  BREAK_TIME_OPTIONS,
  TRANSPORTATION_FEE_OPTIONS,
  JOB_DESCRIPTION_FORMATS,
  DEFAULT_DISMISSAL_REASONS,
  RECRUITMENT_START_DAY_OPTIONS,
  RECRUITMENT_END_DAY_OPTIONS,
  HOUR_OPTIONS,
  END_HOUR_OPTIONS,
  MINUTE_OPTIONS,
  WORK_FREQUENCY_ICONS,
  MONTHLY_COMMITMENT_ICON,
} from '@/constants';

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
  address: string | null;
  prefecture: string | null;
  city: string | null;
  addressLine: string | null;
}

export default function EditJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  const { admin, isAdmin, isAdminLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [facilityInfo, setFacilityInfo] = useState<FacilityData | null>(null);
  const [jobTemplates, setJobTemplates] = useState<TemplateData[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [existingWorkDates, setExistingWorkDates] = useState<{ id: number; date: string; recruitmentCount: number; appliedCount: number }[]>([]);
  const [addedWorkDates, setAddedWorkDates] = useState<string[]>([]);
  const [removedWorkDateIds, setRemovedWorkDateIds] = useState<number[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [formData, setFormData] = useState({
    name: '',
    title: '',
    facilityId: null as number | null,
    jobType: '単発',
    recruitmentCount: 1,
    images: [] as File[],
    existingImages: [] as string[],
    startTime: '',
    endTime: '',
    breakTime: 0,
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
    attachments: [] as File[],
    existingAttachments: [] as string[],
    recruitmentEndDay: 1,
    recruitmentEndTime: '12:00',
    dismissalReasons: DEFAULT_DISMISSAL_REASONS,
    requiresInterview: false, // 面接してからマッチング
    // 住所情報
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine: '',
    building: '',
    address: '',
  });

  const [skillInput, setSkillInput] = useState('');
  const [dresscodeInput, setDresscodeInput] = useState('');
  const [belongingInput, setBelongingInput] = useState('');

  // 勤務日条件
  const [recruitmentOptions, setRecruitmentOptions] = useState({
    noDateSelection: false,
    weeklyFrequency: null as number | null,
    monthlyCommitment: false,
  });

  const handleRecruitmentOptionChange = (option: string, value: any) => {
    if (option === 'noDateSelection') {
      setRecruitmentOptions({
        noDateSelection: value,
        weeklyFrequency: value ? null : recruitmentOptions.weeklyFrequency,
        monthlyCommitment: value ? false : recruitmentOptions.monthlyCommitment,
      });
      // noDateSelectionの場合、関連アイコンを全てクリア
      if (value) {
        const iconsToRemove = [
          ...Object.values(WORK_FREQUENCY_ICONS),
          MONTHLY_COMMITMENT_ICON,
        ];
        setFormData(prev => ({
          ...prev,
          icons: prev.icons.filter(icon => !iconsToRemove.includes(icon)),
        }));
      }
    } else if (option === 'weeklyFrequency') {
      // 週X回の選択は排他的
      const newValue = recruitmentOptions.weeklyFrequency === value ? null : value;
      setRecruitmentOptions({
        ...recruitmentOptions,
        weeklyFrequency: newValue,
      });
      // アイコンも連動して更新
      const allFrequencyIcons: string[] = Object.values(WORK_FREQUENCY_ICONS);
      const newIcon = newValue ? WORK_FREQUENCY_ICONS[newValue as keyof typeof WORK_FREQUENCY_ICONS] : null;
      setFormData(prev => {
        // 既存の週X回アイコンを全て削除
        const filteredIcons = prev.icons.filter(icon => !allFrequencyIcons.includes(icon));
        // 新しいアイコンを追加（nullでない場合）
        return {
          ...prev,
          icons: newIcon ? [...filteredIcons, newIcon] : filteredIcons,
        };
      });
    } else if (option === 'monthlyCommitment') {
      setRecruitmentOptions({
        ...recruitmentOptions,
        monthlyCommitment: value,
      });
      // アイコンも連動して更新
      setFormData(prev => {
        if (value) {
          // アイコンを追加（既にない場合）
          if (!prev.icons.includes(MONTHLY_COMMITMENT_ICON)) {
            return { ...prev, icons: [...prev.icons, MONTHLY_COMMITMENT_ICON] };
          }
        } else {
          // アイコンを削除
          return { ...prev, icons: prev.icons.filter(icon => icon !== MONTHLY_COMMITMENT_ICON) };
        }
        return prev;
      });
    }
  };

  // 認証チェックとデータ取得
  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const fetchData = async () => {
      if (!admin.facilityId || !jobId) return;

      setIsLoading(true);
      try {
        const [jobData, facility, templates] = await Promise.all([
          getJobById(jobId),
          getFacilityInfo(admin.facilityId),
          getAdminJobTemplates(admin.facilityId),
        ]);

        setJobTemplates(templates);

        if (!jobData) {
          toast.error('求人が見つかりません');
          router.push('/admin/jobs');
          return;
        }

        // 別の施設の求人は編集不可
        if (jobData.facility_id !== admin.facilityId) {
          toast.error('この求人を編集する権限がありません');
          router.push('/admin/jobs');
          return;
        }

        if (facility) {
          setFacilityInfo({
            id: facility.id,
            facilityName: facility.facilityName,
            address: facility.address,
            prefecture: facility.prefecture,
            city: facility.city,
            addressLine: facility.addressLine,
          });
        }

        // 勤務日を設定
        if (jobData.workDates && jobData.workDates.length > 0) {
          setExistingWorkDates(jobData.workDates.map((wd: any) => ({
            id: wd.id,
            date: wd.work_date.split('T')[0],
            recruitmentCount: wd.recruitment_count,
            appliedCount: wd.applied_count,
          })));
          // カレンダーを最初の勤務日の月に設定
          setCurrentMonth(new Date(jobData.workDates[0].work_date));
        }

        // break_timeを数値に変換（DBには"0分"形式で保存されている）
        const parseBreakTime = (breakTimeStr: string | number | null): number => {
          if (typeof breakTimeStr === 'number') return breakTimeStr;
          if (!breakTimeStr) return 0;
          const match = String(breakTimeStr).match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };

        // 既存のタグからrecruitmentOptionsを算出
        const existingTags = jobData.tags || [];
        let weeklyFreq: 2 | 3 | 4 | null = null;
        for (const [freq, icon] of Object.entries(WORK_FREQUENCY_ICONS)) {
          if (existingTags.includes(icon)) {
            weeklyFreq = parseInt(freq) as 2 | 3 | 4;
            break;
          }
        }
        const monthlyCommit = existingTags.includes(MONTHLY_COMMITMENT_ICON);

        // recruitmentOptionsを設定（DBの値を優先、なければタグから算出）
        setRecruitmentOptions({
          noDateSelection: false,
          weeklyFrequency: jobData.weekly_frequency ?? weeklyFreq,
          monthlyCommitment: jobData.monthly_commitment ?? monthlyCommit,
        });

        // フォームデータを設定
        setFormData({
          name: '',
          title: jobData.title || '',
          facilityId: jobData.facility_id,
          jobType: '単発',
          recruitmentCount: jobData.workDates?.[0]?.recruitment_count || 1,
          images: [],
          existingImages: jobData.images || [],
          startTime: jobData.start_time || '',
          endTime: jobData.end_time || '',
          breakTime: parseBreakTime(jobData.break_time),
          hourlyWage: jobData.hourly_wage || 1500,
          transportationFee: jobData.transportation_fee || 0,
          workContent: jobData.work_content || [],
          genderRequirement: '',
          jobDescription: jobData.overview || '',
          qualifications: jobData.required_qualifications || [],
          skills: jobData.required_experience || [],
          dresscode: jobData.dresscode || [],
          dresscodeImages: [],
          existingDresscodeImages: jobData.dresscode_images || [],
          belongings: jobData.belongings || [],
          icons: existingTags,
          attachments: [],
          existingAttachments: jobData.attachments || [],

          recruitmentEndDay: 1,
          recruitmentEndTime: '12:00',
          dismissalReasons: DEFAULT_DISMISSAL_REASONS,
          requiresInterview: jobData.requires_interview || false,
          // 住所情報（求人固有の住所があればそれを使用、なければ施設の住所、それもなければ空）
          postalCode: '', // 求人に郵便番号フィールドはないため空、または施設の郵便番号があれば取得
          prefecture: jobData.prefecture || facility?.prefecture || '',
          city: jobData.city || facility?.city || '',
          addressLine: jobData.address_line || facility?.addressLine || '',
          building: '', // building is not in Job schema/Facility schema, user must input or it's part of addressLine
          address: jobData.address || facility?.address || '',
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, admin, isAdminLoading, router, jobId]);

  if (isLoading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-primary"></div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleTemplateSelect = (templateId: number) => {
    const template = jobTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);

      const templateTags = template.tags || [];

      // テンプレートのtagsからrecruitmentOptionsを算出
      // 週X回アイコンをチェック
      let weeklyFrequency: 2 | 3 | 4 | null = null;
      for (const [freq, icon] of Object.entries(WORK_FREQUENCY_ICONS)) {
        if (templateTags.includes(icon)) {
          weeklyFrequency = parseInt(freq) as 2 | 3 | 4;
          break;
        }
      }

      // 1ヶ月以上勤務アイコンをチェック
      const monthlyCommitment = templateTags.includes(MONTHLY_COMMITMENT_ICON);

      // recruitmentOptionsを更新
      setRecruitmentOptions(prev => ({
        ...prev,
        weeklyFrequency,
        monthlyCommitment,
      }));

      setFormData({
        ...formData,
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
      });
    }
  };

  const toggleArrayItem = (field: string, item: string) => {
    const currentArray = formData[field as keyof typeof formData] as string[];
    const isRemoving = currentArray.includes(item);

    if (isRemoving) {
      handleInputChange(field, currentArray.filter(i => i !== item));
    } else {
      handleInputChange(field, [...currentArray, item]);
    }

    // アイコンの場合、勤務日条件との連動を処理
    if (field === 'icons') {
      // 週X回アイコンの場合
      const frequencyEntry = Object.entries(WORK_FREQUENCY_ICONS).find(([_, icon]) => icon === item);
      if (frequencyEntry) {
        const frequencyValue = parseInt(frequencyEntry[0]);
        if (isRemoving) {
          // アイコンを外した場合、勤務日条件も外す
          setRecruitmentOptions(prev => ({
            ...prev,
            weeklyFrequency: prev.weeklyFrequency === frequencyValue ? null : prev.weeklyFrequency,
          }));
        } else {
          // アイコンをつけた場合、勤務日条件も連動（排他的なので他を外す）
          setRecruitmentOptions(prev => ({
            ...prev,
            weeklyFrequency: frequencyValue,
          }));
          // 他の週X回アイコンを外す
          const otherFrequencyIcons: string[] = Object.values(WORK_FREQUENCY_ICONS).filter(icon => icon !== item);
          setFormData(prev => ({
            ...prev,
            icons: prev.icons.filter(icon => !otherFrequencyIcons.includes(icon)),
          }));
        }
      }

      // 1ヶ月以上アイコンの場合
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const result = validateImageFiles(files);

    // エラーがあれば表示
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

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const result = validateAttachmentFiles(files);

    // エラーがあれば表示
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

  const dailyWage = calculateDailyWage(
    formData.startTime,
    formData.endTime,
    formData.breakTime,
    formData.hourlyWage,
    formData.transportationFee
  );

  const requiresGenderSpecification = formData.workContent.includes('入浴介助(大浴場)') ||
    formData.workContent.includes('入浴介助(全般)') ||
    formData.workContent.includes('入浴介助(機械浴)') ||
    formData.workContent.includes('入浴介助(個浴)') ||
    formData.workContent.includes('排泄介助');

  // カレンダー用のヘルパー関数
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleDateClick = (dateString: string) => {
    const existing = existingWorkDates.find(wd => wd.date === dateString);
    if (existing) {
      // 既存の勤務日
      if (removedWorkDateIds.includes(existing.id)) {
        // 削除取り消し
        setRemovedWorkDateIds(prev => prev.filter(id => id !== existing.id));
      } else {
        // 削除（応募がある場合は不可）
        if (existing.appliedCount > 0) {
          toast.error('応募がある勤務日は削除できません');
          return;
        }
        setRemovedWorkDateIds(prev => [...prev, existing.id]);
      }
    } else {
      // 新規追加
      if (addedWorkDates.includes(dateString)) {
        setAddedWorkDates(prev => prev.filter(d => d !== dateString));
      } else {
        setAddedWorkDates(prev => [...prev, dateString]);
      }
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    // バリデーション
    if (!formData.title) {
      toast.error('求人タイトルを入力してください');
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      toast.error('勤務時間を入力してください');
      return;
    }
    if (formData.hourlyWage <= 0) {
      toast.error('時給を入力してください');
      return;
    }
    if (formData.workContent.length === 0) {
      toast.error('仕事内容を選択してください');
      return;
    }
    if (formData.qualifications.length === 0) {
      toast.error('資格条件を選択してください');
      return;
    }
    if (existingWorkDates.filter(wd => !removedWorkDateIds.includes(wd.id)).length === 0 && addedWorkDates.length === 0) {
      toast.error('勤務日を少なくとも1つ選択してください');
      return;
    }

    setIsSaving(true);
    try {
      // 新規画像をアップロード
      let newImageUrls: string[] = [];
      if (formData.images.length > 0) {
        const uploadFormData = new FormData();
        formData.images.forEach((file) => {
          uploadFormData.append('files', file);
        });

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          newImageUrls = uploadResult.urls || [];
        } else {
          toast.error('画像のアップロードに失敗しました');
          setIsSaving(false);
          return;
        }
      }

      const imageUrls = [...formData.existingImages, ...newImageUrls];

      // 服装サンプル画像をアップロード
      let newDresscodeImageUrls: string[] = [];
      if (formData.dresscodeImages.length > 0) {
        const dresscodeFormData = new FormData();
        formData.dresscodeImages.forEach((file) => {
          dresscodeFormData.append('files', file);
        });

        const dresscodeUploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: dresscodeFormData,
        });

        if (dresscodeUploadResponse.ok) {
          const dresscodeUploadResult = await dresscodeUploadResponse.json();
          newDresscodeImageUrls = dresscodeUploadResult.urls || [];
        } else {
          toast.error('服装サンプル画像のアップロードに失敗しました');
          setIsSaving(false);
          return;
        }
      }

      const dresscodeImageUrls = [...formData.existingDresscodeImages, ...newDresscodeImageUrls];

      // 添付ファイルをアップロード
      let newAttachmentUrls: string[] = [];
      if (formData.attachments.length > 0) {
        const attachmentFormData = new FormData();
        formData.attachments.forEach((file) => {
          attachmentFormData.append('files', file);
        });

        const attachmentUploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: attachmentFormData,
        });

        if (attachmentUploadResponse.ok) {
          const attachmentUploadResult = await attachmentUploadResponse.json();
          newAttachmentUrls = attachmentUploadResult.urls || [];
        } else {
          toast.error('添付ファイルのアップロードに失敗しました');
          setIsSaving(false);
          return;
        }
      }

      const attachmentUrls = [...formData.existingAttachments, ...newAttachmentUrls];

      const result = await updateJob(parseInt(jobId), formData.facilityId!, {
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
        images: imageUrls,
        dresscodeImages: dresscodeImageUrls,
        attachments: attachmentUrls,
        addWorkDates: addedWorkDates,
        removeWorkDateIds: removedWorkDateIds,
        requiresInterview: formData.requiresInterview,
        // 住所情報
        prefecture: formData.prefecture,
        city: formData.city,
        addressLine: formData.addressLine,
        // building: formData.building, // schema doesn't have building
        // address: formData.address,
        // UpdateJob should accept these.
      });

      if (result.success) {
        toast.success('求人を更新しました');
        router.push('/admin/jobs');
      } else {
        toast.error(result.error || '求人の更新に失敗しました');
      }
    } catch (error) {
      console.error('Job update error:', error);
      toast.error('求人の更新中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/jobs')}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">求人編集</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(true)}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
            >
              プレビュー
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '更新する'}
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    施設 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={facilityInfo?.facilityName || '読み込み中...'}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    求人種別 <span className="text-red-500">*</span>
                  </label>
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

                <div>
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

              {/* マッチング方法 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresInterview}
                    onChange={(e) => handleInputChange('requiresInterview', e.target.checked)}
                    className="mt-0.5 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">面接してからマッチング</span>
                    <p className="text-xs text-gray-600 mt-1">
                      ワーカーからの応募後に面接・選考を行ってからマッチングを決定できます。<br />
                      <span className="text-red-500 font-bold">※チェックを入れない方がマッチング率は高くなります</span>
                    </p>
                  </div>
                </label>
              </div>

              {/* テンプレート選択 */}
              <div>
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

              {/* 求人タイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  求人タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="例:デイサービス・介護スタッフ募集（日勤）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TOP画像登録（3枚まで） <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">推奨画像サイズ: 1200×800px（比率 3:2）</p>
                <p className="text-xs text-gray-500 mb-3">登録できるファイルサイズは5MBまでです</p>
                <div className="space-y-2">
                  {(formData.existingImages.length + formData.images.length) < 3 && (
                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors">
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">画像を選択</span>
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
                  <div className="grid grid-cols-3 gap-2">
                    {formData.existingImages.map((url, index) => (
                      <div key={`existing-${index}`} className="relative">
                        <img
                          src={url}
                          alt={`既存画像 ${index + 1}`}
                          className="w-full h-24 object-cover rounded border-2 border-blue-200"
                        />
                        <button
                          onClick={() => removeExistingImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.images.map((file, index) => (
                      <div key={`new-${index}`} className="relative">
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
              求人の勤務日を編集できます。応募がある勤務日は削除できません。
            </p>

            <div className="flex gap-6">
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
                    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                    const today = new Date();
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
                      const isExisting = existingWorkDates.some(wd => wd.date === dateString);
                      const isRemoved = isExisting && removedWorkDateIds.includes(existingWorkDates.find(wd => wd.date === dateString)!.id);
                      const isAdded = addedWorkDates.includes(dateString);
                      const isSelected = (isExisting && !isRemoved) || isAdded;
                      const dayOfWeek = currentDate.getDay();

                      days.push(
                        <button
                          key={day}
                          onClick={() => !isPast && handleDateClick(dateString)}
                          disabled={isPast}
                          className={`aspect-square flex items-center justify-center text-[10px] rounded transition-colors relative ${isPast
                            ? 'text-gray-300 cursor-not-allowed'
                            : isSelected
                              ? 'bg-blue-600 text-white font-semibold'
                              : isRemoved
                                ? 'bg-red-100 text-red-500 strikethrough'
                                : dayOfWeek === 0
                                  ? 'text-red-500 hover:bg-red-50'
                                  : dayOfWeek === 6
                                    ? 'text-blue-500 hover:bg-blue-50'
                                    : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          {day}
                          {isAdded && (
                            <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          )}
                        </button>
                      );
                    }

                    return days;
                  })()}
                </div>

                <div className="mt-1.5 text-[10px] text-gray-500">
                  <p>• クリックで追加/削除 • 応募ありは削除不可</p>
                </div>

                {/* この月全てを選択チェックボックス */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(() => {
                        const { daysInMonth, year, month } = getDaysInMonth(currentMonth);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        let selectableDates: string[] = [];
                        for (let day = 1; day <= daysInMonth; day++) {
                          const currentDate = new Date(year, month, day);
                          if (currentDate >= today) {
                            selectableDates.push(formatDate(year, month, day));
                          }
                        }
                        return selectableDates.length > 0 && selectableDates.every(d => addedWorkDates.includes(d) || (existingWorkDates.some(wd => wd.date === d) && !removedWorkDateIds.includes(existingWorkDates.find(wd => wd.date === d)!.id)));
                      })()}
                      onChange={(e) => {
                        const { daysInMonth, year, month } = getDaysInMonth(currentMonth);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        let selectableDates: string[] = [];
                        for (let day = 1; day <= daysInMonth; day++) {
                          const currentDate = new Date(year, month, day);
                          if (currentDate >= today) {
                            selectableDates.push(formatDate(year, month, day));
                          }
                        }
                        if (e.target.checked) {
                          // 選択可能な日付を全て追加
                          // 既存の勤務日（削除されていない）と新規追加の勤務日を考慮
                          selectableDates.forEach(date => {
                            const existing = existingWorkDates.find(wd => wd.date === date);
                            if (existing) {
                              if (removedWorkDateIds.includes(existing.id)) {
                                setRemovedWorkDateIds(prev => prev.filter(id => id !== existing.id));
                              }
                            } else {
                              if (!addedWorkDates.includes(date)) {
                                setAddedWorkDates(prev => [...prev, date]);
                              }
                            }
                          });
                        } else {
                          // この月の日付を全て解除
                          selectableDates.forEach(date => {
                            const existing = existingWorkDates.find(wd => wd.date === date);
                            if (existing) {
                              if (existing.appliedCount === 0 && !removedWorkDateIds.includes(existing.id)) {
                                setRemovedWorkDateIds(prev => [...prev, existing.id]);
                              }
                            } else {
                              if (addedWorkDates.includes(date)) {
                                setAddedWorkDates(prev => prev.filter(d => d !== date));
                              }
                            }
                          });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">この月全てを選択</span>
                  </label>
                </div>
              </div>

              {/* 選択された日付 */}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  選択された求人カード（{existingWorkDates.filter(wd => !removedWorkDateIds.includes(wd.id)).length + addedWorkDates.length}件）
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* 既存の勤務日 */}
                  {existingWorkDates.filter(wd => !removedWorkDateIds.includes(wd.id)).map(wd => {
                    const dateObj = new Date(wd.date);
                    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                    const dayOfWeekIndex = dateObj.getDay();
                    const dateColor = dayOfWeekIndex === 0 ? 'text-red-600' : dayOfWeekIndex === 6 ? 'text-blue-600' : 'text-gray-900';
                    return (
                      <div key={wd.id} className="bg-gray-50 border border-gray-200 rounded p-2 relative flex items-center">
                        <div className={`text-xs font-semibold ${dateColor} pr-16 leading-tight`}>
                          {dateObj.getFullYear()}/{dateObj.getMonth() + 1}/{dateObj.getDate()}（{dayOfWeek}）
                          <span className="ml-2 text-gray-500 font-normal">応募: {wd.appliedCount}名</span>
                        </div>
                        <button
                          onClick={() => handleDateClick(wd.date)}
                          disabled={wd.appliedCount > 0}
                          className={`absolute top-1/2 -translate-y-1/2 right-2 p-0.5 hover:bg-white rounded transition-colors ${wd.appliedCount > 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          title={wd.appliedCount > 0 ? '応募があるため削除できません' : '削除'}
                        >
                          <X className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    );
                  })}
                  {/* 新規追加の勤務日 */}
                  {addedWorkDates.map(date => {
                    const dateObj = new Date(date);
                    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                    const dayOfWeekIndex = dateObj.getDay();
                    const dateColor = dayOfWeekIndex === 0 ? 'text-red-600' : dayOfWeekIndex === 6 ? 'text-blue-600' : 'text-gray-900';
                    return (
                      <div key={date} className="bg-gray-50 border border-gray-200 rounded p-2 relative flex items-center">
                        <div className={`text-xs font-semibold ${dateColor} pr-6 leading-tight`}>
                          {dateObj.getFullYear()}/{dateObj.getMonth() + 1}/{dateObj.getDate()}（{dayOfWeek}）
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-normal">新規</span>
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
                  {existingWorkDates.length === 0 && addedWorkDates.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">カレンダーから勤務日を選択してください</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 勤務日条件チェックボックス */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">勤務日条件</h3>

                {/* 日付を選ばずに募集 */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recruitmentOptions.noDateSelection}
                    onChange={(e) => handleRecruitmentOptionChange('noDateSelection', e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    日付を選ばずに募集
                    <span className="block text-xs text-gray-500 mt-0.5">（他の条件とカレンダーが無効化されます）</span>
                  </span>
                </label>

                {/* 週2回/週3回/週4回（排他的） */}
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recruitmentOptions.weeklyFrequency === 2}
                      onChange={() => handleRecruitmentOptionChange('weeklyFrequency', 2)}
                      disabled={recruitmentOptions.noDateSelection}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-40"
                    />
                    <span className={`text-sm ${recruitmentOptions.noDateSelection ? 'text-gray-400' : 'text-gray-700'}`}>
                      週2回以上勤務できる人を募集
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recruitmentOptions.weeklyFrequency === 3}
                      onChange={() => handleRecruitmentOptionChange('weeklyFrequency', 3)}
                      disabled={recruitmentOptions.noDateSelection}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-40"
                    />
                    <span className={`text-sm ${recruitmentOptions.noDateSelection ? 'text-gray-400' : 'text-gray-700'}`}>
                      週3回以上勤務できる人を募集
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recruitmentOptions.weeklyFrequency === 4}
                      onChange={() => handleRecruitmentOptionChange('weeklyFrequency', 4)}
                      disabled={recruitmentOptions.noDateSelection}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-40"
                    />
                    <span className={`text-sm ${recruitmentOptions.noDateSelection ? 'text-gray-400' : 'text-gray-700'}`}>
                      週4回以上勤務できる人を募集
                    </span>
                  </label>
                </div>

                {/* 1ヶ月以上勤務（独立） */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recruitmentOptions.monthlyCommitment}
                    onChange={(e) => handleRecruitmentOptionChange('monthlyCommitment', e.target.checked)}
                    disabled={recruitmentOptions.noDateSelection}
                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-40"
                  />
                  <span className={`text-sm ${recruitmentOptions.noDateSelection ? 'text-gray-400' : 'text-gray-700'}`}>
                    1ヶ月以上勤務できる人を募集
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* 勤務時間 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">勤務時間</h2>
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
                      // 現在の分を取得
                      const isNextDay = formData.endTime.startsWith('翌');
                      const timePart = isNextDay ? formData.endTime.slice(1) : formData.endTime;
                      const minute = timePart.split(':')[1] || '00';
                      // 新しい時間を設定
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

            {/* 募集開始日 - 編集画面では変更不可 */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  募集開始日 <span className="text-gray-400 text-xs">（変更不可）</span>
                </label>
                <input
                  type="text"
                  value="公開と同時に開始"
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100 text-gray-500"
                />
              </div>
            </div>

            {/* 募集終了日・時間 */}
            <div className="grid grid-cols-2 gap-4 mt-4">
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

          {/* 給与 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">給与</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  時給（円） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.hourlyWage}
                  onChange={(e) => handleInputChange('hourlyWage', Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  交通費（円）
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

          {/* 業務設定 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                  仕事詳細
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const format = JOB_DESCRIPTION_FORMATS.find(f => f.value === e.target.value);
                      if (format) {
                        handleInputChange('jobDescription', format.text);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 mb-2"
                >
                  <option value="">フォーマットを選択</option>
                  {JOB_DESCRIPTION_FORMATS.map(format => (
                    <option key={format.value} value={format.value}>{format.value}</option>
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">条件設定</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  資格条件（複数選択可） <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2 p-3 border border-gray-200 rounded">
                  {QUALIFICATION_OPTIONS.map(option => (
                    <label key={option} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.qualifications.includes(option)}
                        onChange={() => toggleArrayItem('qualifications', option)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  スキル・経験（5つまで）
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
                  服装・身だしなみ（5つまで）
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
                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors">
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">画像を選択</span>
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
                      </div>
                    ))}
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
                  持ち物・その他（5つまで）
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                <p className="text-xs text-red-500 mb-2">登録された文章は公開されます</p>
                <p className="text-xs text-gray-500 mb-3">5MB以下 / 画像(JPG, PNG, HEIC等)・PDF・Word・Excel・テキスト形式</p>
                <div className="space-y-2">
                  {(formData.existingAttachments.length + formData.attachments.length) < 3 && (
                    <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors">
                      <div className="text-center">
                        <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                        <span className="text-sm text-gray-500">ファイルを選択</span>
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
      <JobPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        formData={formData}
        selectedDates={[...existingWorkDates.filter(wd => !removedWorkDateIds.includes(wd.id)).map(wd => wd.date), ...addedWorkDates]}
        facility={facilityInfo ? { id: facilityInfo.id, name: facilityInfo.facilityName, address: facilityInfo.address } : null}
        recruitmentOptions={{ noDateSelection: false, weeklyFrequency: null, monthlyCommitment: false }}
      />
    </div>
  );
}
