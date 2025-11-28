'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, X } from 'lucide-react';
import { calculateDailyWage } from '@/utils/salary';
import toast from 'react-hot-toast';
import { getFacilityById, createJobTemplate } from '@/src/lib/actions';
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

export default function NewTemplatePage() {
  const router = useRouter();
  const { admin, isAdmin } = useAuth();
  const [facilityName, setFacilityName] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    // 基本
    name: '',
    title: '',
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
    notes: '',
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

  // 施設名を取得
  useEffect(() => {
    const loadFacilityName = async () => {
      if (admin?.facilityId) {
        const facility = await getFacilityById(admin.facilityId);
        if (facility) {
          setFacilityName(facility.facility_name);
        }
      }
    };
    loadFacilityName();
  }, [admin?.facilityId]);

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
      toast.error('画像は最大3枚までアップロードできます');
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
      toast.error('添付ファイルは最大3つまでアップロードできます');
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
      toast.error('服装サンプル画像は最大3枚までアップロードできます');
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

  const handleSave = async () => {
    // 二重実行防止
    if (saving) {
      return;
    }

    // バリデーション - 必須項目チェック
    if (!formData.name || !formData.title) {
      toast.error('基本情報の必須項目を入力してください');
      return;
    }
    if (!admin?.facilityId) {
      toast.error('施設情報が取得できません');
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      toast.error('勤務時間の必須項目を入力してください');
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
    if (formData.icons.length === 0) {
      toast.error('アイコンを選択してください');
      return;
    }

    setSaving(true);
    try {
      // TOP画像をアップロードしてURLを取得
      let imageUrls: string[] = [];
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
          imageUrls = uploadResult.urls || [];
        } else {
          toast.error('TOP画像のアップロードに失敗しました');
          setSaving(false);
          return;
        }
      }

      // 服装サンプル画像をアップロード
      let dresscodeImageUrls: string[] = [];
      if (formData.dresscodeImages.length > 0) {
        const uploadFormData = new FormData();
        formData.dresscodeImages.forEach((file) => {
          uploadFormData.append('files', file);
        });

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          dresscodeImageUrls = uploadResult.urls || [];
        } else {
          toast.error('服装サンプル画像のアップロードに失敗しました');
          setSaving(false);
          return;
        }
      }

      // 添付ファイルをアップロード
      let attachmentUrls: string[] = [];
      if (formData.attachments.length > 0) {
        const uploadFormData = new FormData();
        formData.attachments.forEach((file) => {
          uploadFormData.append('files', file);
        });

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          attachmentUrls = uploadResult.urls || [];
        } else {
          toast.error('添付ファイルのアップロードに失敗しました');
          setSaving(false);
          return;
        }
      }

      const result = await createJobTemplate(admin.facilityId, {
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
        images: imageUrls,
        dresscodeImages: dresscodeImageUrls,
        attachments: attachmentUrls,
      });

      if (result.success) {
        toast.success('テンプレートを保存しました');
        router.push('/admin/jobs/templates');
      } else {
        toast.error(result.error || 'テンプレートの保存に失敗しました');
      }
    } catch (error) {
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
            <h1 className="text-xl font-bold text-gray-900">テンプレート作成</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toast('プレビュー機能は実装中です', { icon: '🚧' })}
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

        {/* フォーム */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 基本 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">基本</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    テンプレート名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="例:デイサービス日勤・介護職員"
                  />
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

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      施設
                    </label>
                    <input
                      type="text"
                      value={facilityName || '読み込み中...'}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-gray-100 cursor-not-allowed"
                    />
                  </div>

                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      &nbsp;
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
                            toast.error('5MBを超えるファイルは登録できません');
                            return;
                          }
                          if (formData.images.length + validFiles.length <= 3) {
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
                  <div className="grid grid-cols-4 gap-2 p-2 border border-gray-200 rounded">
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
                  <div className="grid grid-cols-3 gap-2 p-2 border border-gray-200 rounded">
                    {QUALIFICATION_OPTIONS.map(option => (
                      <label key={option} className="flex items-center space-x-2">
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
                            toast.error('5MBを超えるファイルは登録できません');
                            return;
                          }
                          if (formData.dresscodeImages.length + validFiles.length <= 3) {
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
      </div>
  );
}
