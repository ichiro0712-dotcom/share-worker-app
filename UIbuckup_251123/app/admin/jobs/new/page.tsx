'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { facilities } from '@/data/facilities';
import { jobTemplates } from '@/data/jobTemplates';
import { Upload, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { JobPreviewModal } from '@/components/admin/JobPreviewModal';
import { calculateDailyWage } from '@/utils/salary';
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

export default function NewJobPage() {
  const router = useRouter();
  const { admin, isAdmin } = useAuth();

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showPreview, setShowPreview] = useState(false);

  // 募集条件のチェックボックス状態
  const [recruitmentOptions, setRecruitmentOptions] = useState({
    noDateSelection: false,      // 日付を選ばずに募集
    weeklyFrequency: null as 2 | 3 | 4 | null,  // 週2回/週3回/週4回（排他的）
    monthlyCommitment: false,    // 1ヶ月以上勤務
  });
  const [formData, setFormData] = useState({
    // 基本
    name: '',
    title: '',
    facilityId: null as number | null,
    jobType: '通常業務',
    recruitmentCount: 1,
    images: [] as File[],

    // 勤務時間
    startTime: '',
    endTime: '',
    breakTime: 0,
    recruitmentStartDay: 0,
    recruitmentStartTime: '',
    recruitmentEndDay: 0,
    recruitmentEndTime: '05:00',

    // 給与
    hourlyWage: 1500,
    transportationFee: 0,

    // 業務設定
    workContent: [] as string[],
    genderRequirement: '',
    jobDescription: '',

    // 条件設定
    qualifications: [] as string[],
    skills: [] as string[],
    dresscode: [] as string[],
    dresscodeImages: [] as File[],
    belongings: [] as string[],

    // その他
    icons: [] as string[],
    attachments: [] as File[],
    dismissalReasons: DEFAULT_DISMISSAL_REASONS,
  });

  const [skillInput, setSkillInput] = useState('');
  const [dresscodeInput, setDresscodeInput] = useState('');
  const [belongingInput, setBelongingInput] = useState('');

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, router]);

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
    if (formData.images.length + files.length <= 3) {
      handleInputChange('images', [...formData.images, ...files]);
    } else {
      alert('画像は最大3枚までアップロードできます');
    }
  };

  const removeImage = (index: number) => {
    handleInputChange('images', formData.images.filter((_, i) => i !== index));
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (formData.attachments.length + files.length <= 3) {
      handleInputChange('attachments', [...formData.attachments, ...files]);
    } else {
      alert('添付ファイルは最大3つまでアップロードできます');
    }
  };

  const removeAttachment = (index: number) => {
    handleInputChange('attachments', formData.attachments.filter((_, i) => i !== index));
  };

  const handleDresscodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (formData.dresscodeImages.length + files.length <= 3) {
      handleInputChange('dresscodeImages', [...formData.dresscodeImages, ...files]);
    } else {
      alert('服装サンプル画像は最大3枚までアップロードできます');
    }
  };

  const removeDresscodeImage = (index: number) => {
    handleInputChange('dresscodeImages', formData.dresscodeImages.filter((_, i) => i !== index));
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

  const toggleDate = (dateString: string) => {
    if (selectedDates.includes(dateString)) {
      setSelectedDates(selectedDates.filter(d => d !== dateString));
    } else {
      setSelectedDates([...selectedDates, dateString].sort());
    }
  };

  // 募集条件のチェックボックスハンドラー
  const handleRecruitmentOptionChange = (option: 'noDateSelection' | 'weeklyFrequency' | 'monthlyCommitment', value: boolean | number) => {
    if (option === 'noDateSelection') {
      // 日付を選ばずに募集をチェックした場合
      if (value) {
        setRecruitmentOptions({
          noDateSelection: true,
          weeklyFrequency: null,
          monthlyCommitment: false,
        });
        setSelectedDates([]); // カレンダーの選択をクリア
      } else {
        setRecruitmentOptions({
          ...recruitmentOptions,
          noDateSelection: false,
        });
      }
    } else if (option === 'weeklyFrequency') {
      // 週2回/週3回/週4回の選択（排他的）
      const frequency = value as 2 | 3 | 4 | null;
      setRecruitmentOptions({
        ...recruitmentOptions,
        weeklyFrequency: recruitmentOptions.weeklyFrequency === frequency ? null : frequency,
      });
    } else if (option === 'monthlyCommitment') {
      // 1ヶ月以上勤務（独立してチェック可能）
      setRecruitmentOptions({
        ...recruitmentOptions,
        monthlyCommitment: value as boolean,
      });
    }
  };

  const handleTemplateSelect = (templateId: number) => {
    const template = jobTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setFormData({
        ...formData,
        name: template.name,
        title: template.title,
        facilityId: template.facilityId || null,
        jobType: template.jobType || '通常業務',
        recruitmentCount: template.recruitmentCount,
        startTime: template.startTime,
        endTime: template.endTime,
        breakTime: template.breakTime,
        recruitmentStartDay: template.recruitmentStartDay || 0,
        recruitmentStartTime: template.recruitmentStartTime || '',
        recruitmentEndDay: template.recruitmentEndDay || 0,
        recruitmentEndTime: template.recruitmentEndTime || '05:00',
        hourlyWage: template.hourlyWage,
        transportationFee: template.transportationFee,
        workContent: template.workContent || [],
        genderRequirement: template.genderRequirement || '',
        jobDescription: template.description || '',
        qualifications: template.qualifications || [],
        skills: template.skills || [],
        dresscode: template.dresscode || [],
        belongings: template.belongings || [],
        icons: template.icons || [],
      });
    }
  };

  const handleSave = () => {
    // バリデーション - 必須項目チェック
    if (!formData.facilityId) {
      alert('施設を選択してください');
      return;
    }
    if (!formData.jobType) {
      alert('求人種別を選択してください');
      return;
    }
    // 勤務日選択チェック: 日付選択または「日付を選ばずに募集」が必要
    if (selectedDates.length === 0 && !recruitmentOptions.noDateSelection) {
      alert('勤務日を選択するか、「日付を選ばずに募集」にチェックを入れてください');
      return;
    }
    if (!formData.title) {
      alert('求人タイトルを入力してください');
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      alert('勤務時間の必須項目を入力してください');
      return;
    }
    if (formData.hourlyWage <= 0) {
      alert('時給を入力してください');
      return;
    }
    if (formData.workContent.length === 0) {
      alert('仕事内容を選択してください');
      return;
    }
    if (formData.qualifications.length === 0) {
      alert('資格条件を選択してください');
      return;
    }
    if (formData.icons.length === 0) {
      alert('アイコンを選択してください');
      return;
    }

    console.log('求人保存:', formData);
    alert('求人を作成しました');
    router.push('/admin/jobs');
  };

  return (
      <div className="h-full flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">新規求人作成</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(true)}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                プレビュー
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                保存
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
                {/* 1行目：施設、求人種別、募集人数 */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      施設 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.facilityId || ''}
                      onChange={(e) => handleInputChange('facilityId', Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">施設を選択</option>
                      {facilities.slice(0, 10).map((facility) => (
                        <option key={facility.id} value={facility.id}>
                          {facility.name}
                        </option>
                      ))}
                    </select>
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

                {/* 2行目：テンプレート選択 */}
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

                {/* 3行目：求人タイトル */}
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
                    {formData.images.length < 3 && (
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
                            alert('5MBを超えるファイルは登録できません');
                            return;
                          }
                          if (formData.images.length + validFiles.length <= 3) {
                            handleInputChange('images', [...formData.images, ...validFiles]);
                          } else {
                            alert('画像は最大3枚までアップロードできます');
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
                選択した日付で、この条件の求人が作成されます。複数選択すると、1日につき1件の求人カードが生成されます。または「日付を選ばずに募集」を選択してください。
              </p>

              <div className="flex gap-4">
                {/* カレンダー */}
                <div className="w-[280px] flex-shrink-0">
                  <div className={`${recruitmentOptions.noDateSelection ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                        disabled={recruitmentOptions.noDateSelection}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <h3 className="text-sm font-semibold">
                        {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                      </h3>
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        className="p-1 hover:bg-gray-100 rounded"
                        disabled={recruitmentOptions.noDateSelection}
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
                        const isSelected = selectedDates.includes(dateString);
                        const dayOfWeek = currentDate.getDay();

                        days.push(
                          <button
                            key={day}
                            onClick={() => !isPast && !recruitmentOptions.noDateSelection && toggleDate(dateString)}
                            disabled={isPast || recruitmentOptions.noDateSelection}
                            className={`aspect-square flex items-center justify-center text-[10px] rounded transition-colors ${
                              isPast || recruitmentOptions.noDateSelection
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
                  </div>
                </div>

                {/* 選択された日付のプレビューカード */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    選択された求人カード（{selectedDates.length}件）
                  </h3>

                  {selectedDates.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">カレンダーから勤務日を選択してください</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {selectedDates.map((date) => {
                        const dateObj = new Date(date);
                        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                        const dayOfWeekIndex = dateObj.getDay();
                        const dateColor = dayOfWeekIndex === 0 ? 'text-red-600' : dayOfWeekIndex === 6 ? 'text-blue-600' : 'text-gray-900';

                        return (
                          <div key={date} className="bg-gray-50 border border-gray-200 rounded p-2 relative flex items-center">
                            <div className={`text-xs font-semibold ${dateColor} pr-6 leading-tight`}>
                              {dateObj.getFullYear()}/{dateObj.getMonth() + 1}/{dateObj.getDate()}（{dayOfWeek}）
                            </div>
                            <button
                              onClick={() => toggleDate(date)}
                              className="absolute top-1/2 -translate-y-1/2 right-2 p-0.5 hover:bg-white rounded transition-colors"
                              title="削除"
                            >
                              <X className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
              <div className="space-y-4">
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

            {/* 給与 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">給与</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
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
                    仕事詳細 <span className="text-red-500">*</span>
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
                  <p className="text-xs text-gray-500 mb-3">登録できるファイルサイズは5MBまでです</p>
                  <div className="space-y-2">
                    {formData.dresscodeImages.length < 3 && (
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
                            alert('5MBを超えるファイルは登録できません');
                            return;
                          }
                          if (formData.dresscodeImages.length + validFiles.length <= 3) {
                            handleInputChange('dresscodeImages', [...formData.dresscodeImages, ...validFiles]);
                          } else {
                            alert('服装サンプル画像は最大3枚までアップロードできます');
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
                  <div className="space-y-2">
                    {formData.attachments.length < 3 && (
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
                          if (formData.attachments.length + files.length <= 3) {
                            handleInputChange('attachments', [...formData.attachments, ...files]);
                          } else {
                            alert('添付ファイルは最大3つまでです');
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
                    onClick={() => alert('生成された労働条件通知書を表示')}
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
          selectedDates={selectedDates}
          facility={formData.facilityId ? facilities.find(f => f.id === formData.facilityId) : null}
        />
      </div>
  );
}
