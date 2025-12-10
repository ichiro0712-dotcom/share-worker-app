'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, X } from 'lucide-react';
import { calculateDailyWage } from '@/utils/salary';
import { validateImageFiles } from '@/utils/fileValidation';
import toast from 'react-hot-toast';
import { getFacilityById, getJobTemplate, updateJobTemplate } from '@/src/lib/actions';
import {
  JOB_TYPES,
  WORK_CONTENT_OPTIONS,
  ICON_OPTIONS,
  BREAK_TIME_OPTIONS,
  TRANSPORTATION_FEE_OPTIONS,
  JOB_DESCRIPTION_FORMATS,
  DEFAULT_DISMISSAL_REASONS,
  RECRUITMENT_START_DAY_OPTIONS,
  RECRUITMENT_END_DAY_OPTIONS,
} from '@/constants';
import { QUALIFICATION_GROUPS } from '@/constants/qualifications';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { admin, isAdmin } = useAuth();
  const templateId = Number(params.id);
  const [facilityName, setFacilityName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // フォームデータ
  const [formData, setFormData] = useState({
    // 基本
    name: '',
    title: '',
    jobType: '通常業務',
    recruitmentCount: 1,
    images: [] as File[],
    existingImages: [] as string[], // 既存のTOP画像URL

    // 勤務時間
    startTime: '',
    endTime: '',
    breakTime: 0,
    recruitmentStartDay: 0,
    recruitmentStartTime: '',
    recruitmentEndDay: 0,
    recruitmentEndTime: '05:00',

    // 給与
    hourlyWage: 0,
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
    existingDresscodeImages: [] as string[], // 既存の服装サンプル画像URL
    belongings: [] as string[],

    // その他
    icons: [] as string[],
    notes: '',
    attachments: [] as File[],
    existingAttachments: [] as string[], // 既存の添付ファイルURL
    dismissalReasons: `当社では、以下に該当する場合、やむを得ず契約解除となる可能性がございます。

【即時契約解除となる事由】
・無断欠勤・遅刻・早退
・虚偽の報告や不正行為
・利用者様や職員への暴言・暴力
・機密情報の漏洩
・飲酒・薬物使用状態での勤務
・その他、業務遂行が困難と判断される行為

【改善指導後も改善が見られない場合】
・勤務態度不良（指示に従わない、協調性に欠ける等）
・業務遂行能力の著しい不足
・身だしなみ・衛生管理の不備

契約解除の判断は、利用者様の安全確保と施設運営の円滑化を最優先に行います。`,
  });

  useEffect(() => {
    if (!isAdmin || !admin) {
      router.push('/admin/login');
      return;
    }

    // テンプレートデータと施設名を読み込み
    const loadData = async () => {
      setLoading(true);
      try {
        // 施設名を取得
        if (admin.facilityId) {
          const facility = await getFacilityById(admin.facilityId);
          if (facility) {
            setFacilityName(facility.facility_name);
          }
        }

        // テンプレートを取得（facilityIdで権限チェック）
        const template = await getJobTemplate(templateId, admin.facilityId);
        if (template) {
          setFormData((prev) => ({
            ...prev,
            name: template.name,
            title: template.title,
            jobType: template.jobType || '通常業務',
            recruitmentCount: template.recruitmentCount,
            startTime: template.startTime,
            endTime: template.endTime,
            breakTime: template.breakTime,
            recruitmentStartDay: 0,
            recruitmentStartTime: '',
            recruitmentEndDay: 0,
            recruitmentEndTime: '05:00',
            hourlyWage: template.hourlyWage,
            transportationFee: template.transportationFee,
            workContent: template.workContent || [],
            genderRequirement: '',
            jobDescription: template.description,
            qualifications: template.qualifications || [],
            skills: template.skills || [],
            dresscode: template.dresscode || [],
            belongings: template.belongings || [],
            icons: template.icons || [],
            notes: template.notes || '',
            existingImages: template.images || [],
            existingDresscodeImages: template.dresscodeImages || [],
            existingAttachments: template.attachments || [],
          }));
        } else {
          toast.error('テンプレートが見つかりません');
          router.push('/admin/jobs/templates');
        }
      } catch (error) {
        toast.error('データの読み込みに失敗しました');
        router.push('/admin/jobs/templates');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAdmin, admin, router, templateId]);

  if (!isAdmin || !admin) {
    return null;
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  // 性別指定が必要かチェック
  const requiresGenderSpecification = formData.workContent.includes('入浴介助(大浴場)') ||
    formData.workContent.includes('入浴介助(全般)') ||
    formData.workContent.includes('入浴介助(機械浴)') ||
    formData.workContent.includes('入浴介助(個浴)') ||
    formData.workContent.includes('排泄介助');



  // 配列の追加削除
  const toggleArrayItem = (field: string, item: string) => {
    const currentArray = formData[field as keyof typeof formData] as string[];
    if (currentArray.includes(item)) {
      handleInputChange(field, currentArray.filter(i => i !== item));
    } else {
      handleInputChange(field, [...currentArray, item]);
    }
  };

  const addToArray = (field: string, value: string) => {
    if (!value.trim()) return;
    const currentArray = formData[field as keyof typeof formData] as string[];
    // Enforce 5-item limit for skills, dresscode, and belongings
    if (['skills', 'dresscode', 'belongings'].includes(field) && currentArray.length >= 5) {
      return;
    }
    handleInputChange(field, [...currentArray, value.trim()]);
  };

  const removeFromArray = (field: string, index: number) => {
    const currentArray = formData[field as keyof typeof formData] as string[];
    handleInputChange(field, currentArray.filter((_, i) => i !== index));
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

  const handleSave = async () => {
    // 二重実行防止
    if (saving) {
      return;
    }

    // バリデーション
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
          toast.error('TOP画像のアップロードに失敗しました');
          setSaving(false);
          return;
        }
      }

      // 服装サンプル画像をアップロード
      let newDresscodeImageUrls: string[] = [];
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
          newDresscodeImageUrls = uploadResult.urls || [];
        } else {
          const errorResult = await uploadResponse.json().catch(() => ({}));
          toast.error(errorResult.error || '服装サンプル画像のアップロードに失敗しました');
          setSaving(false);
          return;
        }
      }

      // 添付ファイルをアップロード
      let newAttachmentUrls: string[] = [];
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
          newAttachmentUrls = uploadResult.urls || [];
        } else {
          toast.error('添付ファイルのアップロードに失敗しました');
          setSaving(false);
          return;
        }
      }

      // 既存のURLと新規アップロードしたURLを結合
      const finalImages = [...formData.existingImages, ...newImageUrls];
      const finalDresscodeImages = [...formData.existingDresscodeImages, ...newDresscodeImageUrls];
      const finalAttachments = [...formData.existingAttachments, ...newAttachmentUrls];

      const result = await updateJobTemplate(templateId, admin.facilityId, {
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
      });

      if (result.success) {
        toast.success('テンプレートを更新しました');
        router.push('/admin/jobs/templates');
      } else {
        toast.error(result.error || 'テンプレートの更新に失敗しました');
      }
    } catch (error) {
      toast.error('テンプレートの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const [skillInput, setSkillInput] = useState('');
  const [dresscodeInput, setDresscodeInput] = useState('');
  const [belongingsInput, setBelongingsInput] = useState('');

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">テンプレート編集</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toast('プレビュー機能は実装中です', { icon: '🚧' })}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
            >
              プレビュー
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    テンプレート名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="例：デイサービス日勤・介護職員"
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
                    placeholder="例：デイサービス・介護スタッフ募集（日勤）"
                  />
                </div>
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
                    {JOB_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
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
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        {num}人
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TOP画像登録 <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500">（最大3枚）</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">推奨画像サイズ: 1200×800px</p>
                <p className="text-xs text-gray-500 mb-3">登録できるファイルサイズは5MBまでです</p>
                <div className="space-y-3">
                  <label
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
                      const files = Array.from(e.dataTransfer.files).filter((file) =>
                        file.type.startsWith('image/')
                      );
                      const totalImages = formData.existingImages.length + formData.images.length + files.length;
                      if (totalImages <= 3) {
                        handleInputChange('images', [...formData.images, ...files]);
                      } else {
                        toast.error('画像は最大3枚までアップロードできます');
                      }
                    }}
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-gray-400 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">画像を選択 または ドラッグ&ドロップ</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const totalImages = formData.existingImages.length + formData.images.length + files.length;
                        if (totalImages <= 3) {
                          handleInputChange('images', [...formData.images, ...files]);
                        } else {
                          toast.error('画像は最大3枚までアップロードできます');
                        }
                      }}
                    />
                  </label>

                  {/* 既存画像の表示 */}
                  {formData.existingImages.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">登録済み画像:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {formData.existingImages.map((url, index) => (
                          <div key={`existing-${index}`} className="relative">
                            <img
                              src={url}
                              alt={`登録済み画像 ${index + 1}`}
                              className="w-full h-24 object-cover rounded border border-gray-300"
                            />
                            <button
                              onClick={() => {
                                handleInputChange('existingImages', formData.existingImages.filter((_, i) => i !== index));
                              }}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 新規アップロード画像の表示 */}
                  {formData.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {formData.images.map((file, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`プレビュー ${index + 1}`}
                            className="w-full h-24 object-cover rounded border border-gray-300"
                          />
                          <button
                            onClick={() => removeFromArray('images', index)}
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
                    {BREAK_TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    募集開始 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.recruitmentStartDay}
                      onChange={(e) => handleInputChange('recruitmentStartDay', Number(e.target.value))}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value={0}>当日</option>
                      <option value={1}>前日</option>
                      <option value={2}>2日前</option>
                      <option value={3}>3日前</option>
                      <option value={7}>7日前</option>
                    </select>
                    <input
                      type="time"
                      value={formData.recruitmentStartTime}
                      onChange={(e) => handleInputChange('recruitmentStartTime', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    募集終了 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.recruitmentEndDay}
                      onChange={(e) => handleInputChange('recruitmentEndDay', Number(e.target.value))}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value={0}>当日</option>
                      <option value={-1}>前日</option>
                      <option value={-2}>2日前</option>
                      <option value={-3}>3日前</option>
                    </select>
                    <input
                      type="time"
                      value={formData.recruitmentEndTime}
                      onChange={(e) => handleInputChange('recruitmentEndTime', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
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
                  日給（円）
                </label>
                <input
                  type="number"
                  value={calculateDailyWage(
                    formData.startTime,
                    formData.endTime,
                    formData.breakTime,
                    formData.hourlyWage,
                    formData.transportationFee
                  )}
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
                  仕事内容 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {WORK_CONTENT_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.workContent.includes(option)}
                        onChange={() => toggleArrayItem('workContent', option)}
                        className="rounded"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              {formData.workContent.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    性別指定 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="genderRequirement"
                        value="男女問わず"
                        checked={formData.genderRequirement === '男女問わず'}
                        onChange={(e) => handleInputChange('genderRequirement', e.target.value)}
                      />
                      男女問わず
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="genderRequirement"
                        value="男性のみ"
                        checked={formData.genderRequirement === '男性のみ'}
                        onChange={(e) => handleInputChange('genderRequirement', e.target.value)}
                      />
                      男性のみ
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="genderRequirement"
                        value="女性のみ"
                        checked={formData.genderRequirement === '女性のみ'}
                        onChange={(e) => handleInputChange('genderRequirement', e.target.value)}
                      />
                      女性のみ
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  仕事内容 <span className="text-red-500">*</span>
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
                  placeholder="具体的な業務内容を入力してください"
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
                  資格条件 <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-200 rounded p-4">
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

                  {/* 無資格可オプション（求人のみ） */}
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
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addToArray('skills', skillInput);
                        setSkillInput('');
                      }
                    }}
                    disabled={formData.skills.length >= 5}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                    placeholder="例：認知症ケア経験1年以上"
                  />
                  <button
                    onClick={() => {
                      addToArray('skills', skillInput);
                      setSkillInput('');
                    }}
                    disabled={formData.skills.length >= 5}
                    className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300"
                  >
                    追加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded flex items-center gap-2"
                    >
                      {skill}
                      <button
                        onClick={() => removeFromArray('skills', index)}
                        className="text-gray-500 hover:text-red-600"
                      >
                        ×
                      </button>
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
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addToArray('dresscode', dresscodeInput);
                        setDresscodeInput('');
                      }
                    }}
                    disabled={formData.dresscode.length >= 5}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                    placeholder="例：制服貸与、ネイル・ピアスNG"
                  />
                  <button
                    onClick={() => {
                      addToArray('dresscode', dresscodeInput);
                      setDresscodeInput('');
                    }}
                    disabled={formData.dresscode.length >= 5}
                    className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300"
                  >
                    追加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.dresscode.map((item, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded flex items-center gap-2"
                    >
                      {item}
                      <button
                        onClick={() => removeFromArray('dresscode', index)}
                        className="text-gray-500 hover:text-red-600"
                      >
                        ×
                      </button>
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
                        const totalDresscodeImages = formData.existingDresscodeImages.length + formData.dresscodeImages.length + validFiles.length;
                        if (totalDresscodeImages <= 3) {
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
                  {/* 既存服装サンプル画像の表示 */}
                  {formData.existingDresscodeImages.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">登録済み服装サンプル:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {formData.existingDresscodeImages.map((url, index) => (
                          <div key={`existing-dresscode-${index}`} className="relative">
                            <img
                              src={url}
                              alt={`登録済み服装サンプル ${index + 1}`}
                              className="w-full h-24 object-cover rounded"
                            />
                            <button
                              onClick={() => {
                                handleInputChange('existingDresscodeImages', formData.existingDresscodeImages.filter((_, i) => i !== index));
                              }}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 新規服装サンプル画像 */}
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
                    value={belongingsInput}
                    onChange={(e) => setBelongingsInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addToArray('belongings', belongingsInput);
                        setBelongingsInput('');
                      }
                    }}
                    disabled={formData.belongings.length >= 5}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100"
                    placeholder="例：筆記用具、上履き"
                  />
                  <button
                    onClick={() => {
                      addToArray('belongings', belongingsInput);
                      setBelongingsInput('');
                    }}
                    disabled={formData.belongings.length >= 5}
                    className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300"
                  >
                    追加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.belongings.map((item, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded flex items-center gap-2"
                    >
                      {item}
                      <button
                        onClick={() => removeFromArray('belongings', index)}
                        className="text-gray-500 hover:text-red-600"
                      >
                        ×
                      </button>
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
                  オススメ（アイコン） <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ICON_OPTIONS.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.icons.includes(option)}
                        onChange={() => toggleArrayItem('icons', option)}
                        className="rounded"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  その他添付文章
                </label>
                <p className="text-xs text-gray-500 mb-2">5MB以下 / 画像(JPG, PNG, HEIC等)・PDF・Word・Excel・テキスト形式</p>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    handleInputChange('attachments', [...formData.attachments, ...files]);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {/* 既存の添付ファイル */}
                {formData.existingAttachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500 mb-1">登録済みファイル:</p>
                    {formData.existingAttachments.map((url, index) => (
                      <div key={`existing-attachment-${index}`} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-xs">
                          {url.split('/').pop()}
                        </a>
                        <button
                          onClick={() => {
                            handleInputChange('existingAttachments', formData.existingAttachments.filter((_, i) => i !== index));
                          }}
                          className="text-red-600 hover:text-red-800 ml-2"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 新規添付ファイル */}
                {formData.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-sm text-gray-600">
                        <span>{file.name}</span>
                        <button
                          onClick={() => removeFromArray('attachments', index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
