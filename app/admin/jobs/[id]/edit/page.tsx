'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, X, ChevronLeft, ChevronRight, Calendar, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { JobPreviewModal } from '@/components/admin/JobPreviewModal';
import { calculateDailyWage } from '@/utils/salary';
import { getJobById, updateJob, getFacilityInfo } from '@/src/lib/actions';
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
} from '@/constants';

interface FacilityData {
  id: number;
  facilityName: string;
  address: string;
}

export default function EditJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  const { admin, isAdmin } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [facilityInfo, setFacilityInfo] = useState<FacilityData | null>(null);
  const [existingWorkDates, setExistingWorkDates] = useState<{ id: number; date: string; recruitmentCount: number; appliedCount: number }[]>([]);
  const [addedWorkDates, setAddedWorkDates] = useState<string[]>([]);
  const [removedWorkDateIds, setRemovedWorkDateIds] = useState<number[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [formData, setFormData] = useState({
    name: '',
    title: '',
    facilityId: null as number | null,
    jobType: '通常業務',
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
    dismissalReasons: DEFAULT_DISMISSAL_REASONS,
  });

  const [skillInput, setSkillInput] = useState('');
  const [dresscodeInput, setDresscodeInput] = useState('');
  const [belongingInput, setBelongingInput] = useState('');

  // 認証チェックとデータ取得
  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    const fetchData = async () => {
      if (!admin.facilityId || !jobId) return;

      setIsLoading(true);
      try {
        const [jobData, facility] = await Promise.all([
          getJobById(jobId),
          getFacilityInfo(admin.facilityId),
        ]);

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
          setFacilityInfo(facility);
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

        // フォームデータを設定
        setFormData({
          name: '',
          title: jobData.title || '',
          facilityId: jobData.facility_id,
          jobType: '通常業務',
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
          icons: jobData.tags || [],
          attachments: [],
          existingAttachments: jobData.attachments || [],
          dismissalReasons: DEFAULT_DISMISSAL_REASONS,
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isAdmin, admin, router, jobId]);

  if (!isAdmin || !admin) {
    return null;
  }

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
    const totalImages = formData.existingImages.length + formData.images.length + files.length;
    if (totalImages <= 3) {
      handleInputChange('images', [...formData.images, ...files]);
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
    const totalDresscodeImages = formData.existingDresscodeImages.length + formData.dresscodeImages.length + files.length;
    if (totalDresscodeImages <= 3) {
      handleInputChange('dresscodeImages', [...formData.dresscodeImages, ...files]);
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
    const totalAttachments = formData.existingAttachments.length + formData.attachments.length + files.length;
    if (totalAttachments <= 3) {
      handleInputChange('attachments', [...formData.attachments, ...files]);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    施設
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
                  TOP画像（3枚まで）
                </label>
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
              勤務日 <span className="text-red-500">*</span>
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              求人の勤務日を選択してください。
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
              </div>

              {/* 選択された日付 */}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  選択中の勤務日
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* 既存の勤務日 */}
                  {existingWorkDates.filter(wd => !removedWorkDateIds.includes(wd.id)).map(wd => {
                    const dateObj = new Date(wd.date);
                    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                    return (
                      <div key={wd.id} className="bg-blue-50 border border-blue-200 rounded p-2 flex justify-between items-center">
                        <span className="text-sm font-semibold text-blue-800">
                          {dateObj.getFullYear()}年{dateObj.getMonth() + 1}月{dateObj.getDate()}日（{dayOfWeek}）
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">応募: {wd.appliedCount}名</span>
                          <button
                            onClick={() => handleDateClick(wd.date)}
                            className={`text-xs text-red-500 hover:text-red-700 ${wd.appliedCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={wd.appliedCount > 0}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {/* 新規追加の勤務日 */}
                  {addedWorkDates.map(date => {
                    const dateObj = new Date(date);
                    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                    return (
                      <div key={date} className="bg-green-50 border border-green-200 rounded p-2 flex justify-between items-center">
                        <span className="text-sm font-semibold text-green-800">
                          {dateObj.getFullYear()}年{dateObj.getMonth() + 1}月{dateObj.getDate()}日（{dayOfWeek}）
                          <span className="ml-2 text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">新規</span>
                        </span>
                        <button
                          onClick={() => handleDateClick(date)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          削除
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
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  終了時刻 <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
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
                  アイコン
                </label>
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
                  添付ファイル（3つまで）
                </label>
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
