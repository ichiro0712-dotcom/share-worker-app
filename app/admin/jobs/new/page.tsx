'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { facilities } from '@/data/facilities';
import { jobTemplates } from '@/data/jobTemplates';
import { Upload, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { JobPreviewModal } from '@/components/admin/JobPreviewModal';

// 定数データ
const JOB_TYPES = ['通常業務', '説明会'];

const BREAK_TIME_OPTIONS = [
  { value: 0, label: 'なし' },
  { value: 10, label: '10分' },
  { value: 30, label: '30分' },
  { value: 60, label: '60分' },
  { value: 90, label: '90分' },
  { value: 120, label: '120分' },
];

const TRANSPORTATION_FEE_OPTIONS = [
  { value: 0, label: 'なし' },
  ...Array.from({ length: 30 }, (_, i) => ({
    value: (i + 1) * 100,
    label: `${(i + 1) * 100}円`
  }))
];

const JOB_DESCRIPTION_FORMATS = [
  {
    value: '介護:日勤',
    text: `【介護業務（日勤）】
・利用者様の日常生活介助（食事・入浴・排泄等）
・移乗・移動介助、体位変換
・レクリエーション、機能訓練の補助
・バイタル測定、記録業務
・環境整備、清掃`
  },
  {
    value: '介護:夜勤',
    text: `【介護業務（夜勤）】
・夜間巡視、安全確認
・就寝介助、起床介助
・排泄介助、体位変換
・コール対応、緊急時対応
・記録業務、申し送り`
  },
  {
    value: '看護:日勤',
    text: `【看護業務（日勤）】
・バイタルチェック、健康管理
・服薬管理、処置業務
・医療行為の実施（喀痰吸引、経管栄養等）
・医師の指示による医療処置
・記録業務、申し送り`
  },
  {
    value: '看護:夜勤',
    text: `【看護業務（夜勤）】
・夜間の健康観察、巡視
・バイタルチェック、緊急時対応
・服薬管理、処置業務
・医療行為の実施
・記録業務、申し送り`
  },
  {
    value: 'ドライバー',
    text: `【送迎ドライバー業務】
・利用者様の送迎（運転業務）
・乗降介助、安全確認
・車両の日常点検、清掃
・送迎記録の作成
・施設内での軽作業補助`
  },
  {
    value: '生活相談員',
    text: `【生活相談員業務】
・利用者様・ご家族との相談対応
・ケアプラン作成、サービス調整
・関係機関との連絡調整
・契約業務、事務手続き
・施設内の調整業務`
  },
  {
    value: '病院:看護補助',
    text: `【看護補助業務】
・患者様の日常生活援助
・食事介助、排泄介助、入浴介助
・環境整備、リネン交換
・配膳・下膳、物品管理
・看護師の補助業務`
  },
  {
    value: '病院:看護日勤',
    text: `【病院看護業務（日勤）】
・バイタルチェック、観察業務
・医師の診療補助
・点滴・注射等の医療処置
・記録業務、カンファレンス
・患者様・ご家族への説明`
  },
  {
    value: '病院:看護日勤（急性期）',
    text: `【急性期病院看護業務（日勤）】
・重症患者の観察・看護
・緊急入院対応、救急処置
・手術前後の看護
・医療機器の管理
・多職種連携、記録業務`
  },
  {
    value: '病院:看護夜勤',
    text: `【病院看護業務（夜勤）】
・夜間の患者観察、巡視
・バイタルチェック、緊急時対応
・医療処置、看護ケア
・記録業務、申し送り
・夜間の検査・処置対応`
  },
  {
    value: '説明会',
    text: `【施設説明会】
・施設概要のご説明
・業務内容のご紹介
・勤務条件・待遇のご説明
・施設見学
・質疑応答`
  },
];

const RECRUITMENT_START_DAY_OPTIONS = [
  { value: 0, label: '公開時' },
  { value: -1, label: '勤務当日' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: -(i + 2), label: `勤務${i + 1}日前` })),
];

const RECRUITMENT_END_DAY_OPTIONS = [
  { value: 0, label: '勤務開始時' },
  { value: -1, label: '勤務当日' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: -(i + 2), label: `勤務${i + 1}日前` })),
];

const WORK_CONTENT_OPTIONS = [
  '対話・見守り', '移動介助', '排泄介助', '入浴介助(大浴場)', '整容', '食事介助', '服薬介助', '起床介助',
  'リネン交換', '送迎(運転)', '巡視・巡回', '清拭', '経管栄養', '説明会', 'コール対応', '移乗介助',
  '入浴介助(全般)', '入浴介助(機械浴)', '薬・軟膏塗布', '調理・調理補助', '口腔ケア', '就寝介助',
  'レク・体操', '送迎(添乗)', '事務作業', '爪切り', '胃ろう', '環境整備', '記録業務', '体位変換',
  '入浴介助(個浴)', '更衣介助', '洗濯', '配膳下膳', 'バイタル測定', '清掃', '外出介助', '夜勤(全般)',
  '機能訓練', '痰吸引', '褥瘡ケア'
];

const QUALIFICATION_OPTIONS = [
  '介護福祉士', '実務者研修', '初任者研修', 'ヘルパー1級', 'ヘルパー2級', '認知症介護基礎研修',
  '認知症介護実践者研修', '看護師', '准看護師', '認定看護師', '専門看護師', '保健師', '助産師',
  '社会福祉士', '社会福祉主事', '理学療法士', '作業療法士', '言語聴覚士', '介護支援専門員',
  '認定介護福祉士', '介護職員基礎研修', '認知症介護実践リーダー研修', '喀痰吸引等研修',
  '精神保健福祉士', '福祉用具専門相談員', '重度訪問介護従業者養成研修 基礎課程',
  '重度訪問介護従業者養成研修 追加課程', '難病患者等ホームヘルパー養成研修 基礎課程 I',
  '難病患者等ホームヘルパー養成研修 基礎課程II', '全身性障害者ガイドヘルパー養成研修',
  '同行援護従事者養成研修', '行動援護従事者養成研修', 'レクリエーション介護士1級',
  'レクリエーション介護士2級', 'ドライバー(運転免許証)', '看護助手認定実務者', '管理栄養士',
  '栄養士', '調理師', '柔道整復師', 'あん摩マッサージ指圧師', 'はり師', 'きゅう師', '保育士',
  '歯科衛生士', '医療事務認定実務者', '医師', '薬剤師', '保険薬剤師登録票', '無資格可'
];

const ICON_OPTIONS = [
  '未経験者歓迎', 'SWORKS初心者歓迎', 'ブランク歓迎', '髪型・髪色自由', 'ネイルOK', '制服貸与'
];

const DEFAULT_DISMISSAL_REASONS = `[解雇の事由]
(1) 身体または精神の障害により業務に耐えられないと認められるとき
(2) 勤怠不良で改善の見込みがないとき
(3) 利用者への暴行、脅迫、傷害、暴言その他のこれに類する行為のほか、身体拘束や虐待に該当し得る行為があったとき
(4) 会社の体面・信用を損なうような行為を行ったとき
(5) 採用されるに際し、提出した情報と事実に相違する箇所があったとき
(6) 業務上で知り得た使用者の一切の情報（個人情報を含み、以下「秘密情報」といいます。）が漏洩したと認められた際に報告を怠ったとき
(7) 労働者が反社会的勢力（暴力団、暴力団関係企業、総会屋、社会運動等標榜ゴロまたは特殊知能暴力集団その他これに準ずる者）に該当し、またはこれらと関係を有すると判明したとき
(8) その他前各号に準ずるやむを得ない事由が生じたとき`;

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

  // 日給計算
  const calculateDailyWage = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    const [startHour, startMin] = formData.startTime.split(':').map(Number);
    const [endHour, endMin] = formData.endTime.split(':').map(Number);
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    totalMinutes -= formData.breakTime;
    const workHours = totalMinutes / 60;
    return Math.round(formData.hourlyWage * workHours) + formData.transportationFee;
  };

  const dailyWage = calculateDailyWage();

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
      });
    }
  };

  const handleSave = () => {
    // バリデーション - 必須項目チェック
    if (!formData.facilityId) {
      alert('事業所を選択してください');
      return;
    }
    if (!formData.jobType) {
      alert('案件種別を選択してください');
      return;
    }
    // 勤務日選択チェック: 日付選択または「日付を選ばずに募集」が必要
    if (selectedDates.length === 0 && !recruitmentOptions.noDateSelection) {
      alert('勤務日を選択するか、「日付を選ばずに募集」にチェックを入れてください');
      return;
    }
    if (!formData.title) {
      alert('案件タイトルを入力してください');
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

    console.log('案件保存:', formData);
    alert('案件を作成しました');
    router.push('/admin/jobs');
  };

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">新規案件作成</h1>
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
                {/* 1行目：事業所、案件種別、募集人数 */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      事業所 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.facilityId || ''}
                      onChange={(e) => handleInputChange('facilityId', Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">事業所を選択</option>
                      {facilities.slice(0, 10).map((facility) => (
                        <option key={facility.id} value={facility.id}>
                          {facility.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      案件種別 <span className="text-red-500">*</span>
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

                {/* 3行目：案件タイトル */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    案件タイトル <span className="text-red-500">*</span>
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
      </div>

      {/* プレビューモーダル */}
      <JobPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        formData={formData}
        selectedDates={selectedDates}
        facility={formData.facilityId ? facilities.find(f => f.id === formData.facilityId) : null}
      />
    </AdminLayout>
  );
}
