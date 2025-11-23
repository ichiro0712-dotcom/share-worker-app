'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { facilities } from '@/data/facilities';
import { jobTemplates } from '@/data/jobTemplates';
import { Upload, X } from 'lucide-react';
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

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { admin, isAdmin } = useAuth();
  const templateId = Number(params.id);

  // フォームデータ
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
    belongings: [] as string[],

    // その他
    icons: [] as string[],
    notes: '',
    attachments: [] as File[],
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

    // テンプレートデータを読み込み
    const template = jobTemplates.find(t => t.id === templateId);
    if (template) {
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
        jobDescription: template.description,
        qualifications: template.qualifications,
        skills: template.skills || [],
        dresscode: template.dresscode || [],
        belongings: template.belongings || [],
        icons: template.icons || [],
        notes: template.notes || '',
      });
    } else {
      alert('テンプレートが見つかりません');
      router.push('/admin/jobs/templates');
    }
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
    if (formData.dresscodeImages.length + files.length <= 3) {
      handleInputChange('dresscodeImages', [...formData.dresscodeImages, ...files]);
    } else {
      alert('服装サンプル画像は最大3枚までアップロードできます');
    }
  };

  const removeDresscodeImage = (index: number) => {
    handleInputChange('dresscodeImages', formData.dresscodeImages.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // バリデーション
    if (!formData.name || !formData.title || !formData.facilityId) {
      alert('基本情報の必須項目を入力してください');
      return;
    }

    if (formData.images.length === 0) {
      alert('TOP画像を登録してください（最大3枚）');
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      alert('勤務時間の必須項目を入力してください');
      return;
    }

    if (!formData.recruitmentStartTime || !formData.recruitmentEndTime) {
      alert('募集開始・終了時間を入力してください');
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

    // 男女問わず以外が選択されている場合、性別指定が必須
    const hasGenderSpecificWork = formData.workContent.some(
      item => item !== '対話・見守り' && item !== '移動介助' && item !== '排泄介助'
    );
    if (hasGenderSpecificWork && !formData.genderRequirement) {
      alert('性別指定を選択してください');
      return;
    }

    if (!formData.jobDescription) {
      alert('仕事内容の詳細を入力してください');
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

    // 保存処理（ダミー）
    console.log('テンプレート更新:', { id: templateId, ...formData });
    alert('テンプレートを更新しました');
    router.push('/admin/jobs/templates');
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
                onClick={() => alert('プレビュー機能は実装中です')}
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
                        if (formData.images.length + files.length <= 3) {
                          handleInputChange('images', [...formData.images, ...files]);
                        } else {
                          alert('画像は最大3枚までアップロードできます');
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
                          if (formData.images.length + files.length <= 3) {
                            handleInputChange('images', [...formData.images, ...files]);
                          } else {
                            alert('画像は最大3枚までアップロードできます');
                          }
                        }}
                      />
                    </label>

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
                  <div className="grid grid-cols-3 gap-2">
                    {QUALIFICATION_OPTIONS.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.qualifications.includes(option)}
                          onChange={() => toggleArrayItem('qualifications', option)}
                          className="rounded"
                        />
                        {option}
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
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      handleInputChange('attachments', [...formData.attachments, ...files]);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
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
      </div>
  );
}
