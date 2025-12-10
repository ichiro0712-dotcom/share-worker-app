'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, X, Eye, User, Loader2, Plus, Trash2, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getFacilityInfo,
  updateFacilityBasicInfo,
  updateFacilityMapImage,
  getFacilityAccounts,
  addFacilityAccount,
  updateFacilityAccount,
  updateFacilityAccountPassword,
  deleteFacilityAccount,
} from '@/src/lib/actions';
import { MapPin } from 'lucide-react';
import { validateFile } from '@/utils/fileValidation';
import AddressSelector from '@/components/ui/AddressSelector';
import { SERVICE_TYPES } from '@/constants/serviceTypes';

export default function FacilityPage() {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingMap, setIsUpdatingMap] = useState(false);
  // 住所変更検知用：ロード時の住所を保存
  const [originalAddress, setOriginalAddress] = useState('');

  // アカウント管理
  const [accounts, setAccounts] = useState<{
    id: number;
    email: string;
    name: string;
    is_primary: boolean;
    created_at: Date;
  }[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<number | null>(null);
  const [newAccount, setNewAccount] = useState({ name: '', email: '', password: '' });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // 法人情報
  const [corporateInfo, setCorporateInfo] = useState({
    name: '',
    representativeLastName: '',
    representativeFirstName: '',
    phone: '',
    prefecture: '',
    city: '',
    addressDetail: '',
    email: '',
    contactPersonLastName: '',
    contactPersonFirstName: '',
  });

  // 施設情報
  const [facilityInfo, setFacilityInfo] = useState({
    name: '',
    serviceType: '',
  });

  // 責任者情報
  const [managerInfo, setManagerInfo] = useState({
    lastName: '',
    firstName: '',
    photo: null as File | null,
    photoPreview: '',
    greeting: '',
  });

  // 担当者情報
  const [staffInfo, setStaffInfo] = useState({
    sameAsManager: false,
    lastName: '',
    firstName: '',
    phone: '',
    emergencyContact: '',
    emails: [''],
  });

  // 服装情報
  const [dresscodeInfo, setDresscodeInfo] = useState({
    items: [] as string[],
    images: [] as File[],
  });
  // 既存の服装画像URL
  // 既存の服装画像URL
  // 削除済み

  const dresscodeOptions = [
    '制服貸与', '私服', '動きやすい服装', 'スニーカー', '靴下', 'エプロン',
    'ナースシューズ', '上履き', 'スクラブ', '白衣', 'ポロシャツ', 'ジャージ',
    '髪型自由', '髪色自由', 'ネイルOK', 'ピアスOK', '髭OK', 'タトゥーOK（隠せる範囲）',
  ];

  // アクセス情報
  const [accessInfo, setAccessInfo] = useState({
    stations: [
      { name: '', minutes: 0 },
    ] as { name: string; minutes: number }[],
    accessDescription: '',
    transportation: [] as string[],
    parking: '',
    transportationNote: '',
    mapLat: 0,
    mapLng: 0,
    mapImage: '' as string,
  });

  const transportationOptions = ['車', 'バイク', '自転車', '公共交通機関（電車・バス・徒歩）'];
  const parkingOptions = [
    '選択してください',
    'あり（無料）',
    'あり（有料）',
    'なし（近隣コインパーキング）',
  ];

  // 受動喫煙防止対策
  const [smokingInfo, setSmokingInfo] = useState({
    measure: '',
    workInSmokingArea: '',
  });

  const smokingMeasures = [
    '選択してください',
    '敷地内禁煙',
    '敷地内禁煙（屋外に喫煙場所設置）',
    '屋内禁煙',
    '屋内原則禁煙（喫煙専用室あり）',
    '屋内原則禁煙（加熱式たばこ専用喫煙室あり）',
    '屋内原則禁煙（喫煙可の宿泊室あり）',
  ];

  // サービス種別

  // サービス種別
  // 定数から取得するため削除


  // 都道府県リスト
  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  // 市区町村データ（都道府県ごと）
  const citiesByPrefecture: { [key: string]: string[] } = {
    '東京都': [
      '千代田区', '中央区', '港区', '新宿区', '文京区', '台東区', '墨田区', '江東区',
      '品川区', '目黒区', '大田区', '世田谷区', '渋谷区', '中野区', '杉並区', '豊島区',
      '北区', '荒川区', '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区',
      '八王子市', '立川市', '武蔵野市', '三鷹市', '青梅市', '府中市', '昭島市', '調布市',
      '町田市', '小金井市', '小平市', '日野市', '東村山市', '国分寺市', '国立市', '福生市',
      '狛江市', '東大和市', '清瀬市', '東久留米市', '武蔵村山市', '多摩市', '稲城市', '羽村市',
      'あきる野市', '西東京市'
    ],
    '神奈川県': [
      '横浜市鶴見区', '横浜市神奈川区', '横浜市西区', '横浜市中区', '横浜市南区', '横浜市保土ケ谷区',
      '横浜市磯子区', '横浜市金沢区', '横浜市港北区', '横浜市戸塚区', '横浜市港南区', '横浜市旭区',
      '横浜市緑区', '横浜市瀬谷区', '横浜市栄区', '横浜市泉区', '横浜市青葉区', '横浜市都筑区',
      '川崎市川崎区', '川崎市幸区', '川崎市中原区', '川崎市高津区', '川崎市多摩区', '川崎市宮前区', '川崎市麻生区',
      '相模原市緑区', '相模原市中央区', '相模原市南区',
      '横須賀市', '平塚市', '鎌倉市', '藤沢市', '小田原市', '茅ヶ崎市', '逗子市', '三浦市',
      '秦野市', '厚木市', '大和市', '伊勢原市', '海老名市', '座間市', '南足柄市', '綾瀬市'
    ],
    '大阪府': [
      '大阪市都島区', '大阪市福島区', '大阪市此花区', '大阪市西区', '大阪市港区', '大阪市大正区',
      '大阪市天王寺区', '大阪市浪速区', '大阪市西淀川区', '大阪市東淀川区', '大阪市東成区', '大阪市生野区',
      '大阪市旭区', '大阪市城東区', '大阪市阿倍野区', '大阪市住吉区', '大阪市東住吉区', '大阪市西成区',
      '大阪市淀川区', '大阪市鶴見区', '大阪市住之江区', '大阪市平野区', '大阪市北区', '大阪市中央区',
      '堺市堺区', '堺市中区', '堺市東区', '堺市西区', '堺市南区', '堺市北区', '堺市美原区',
      '岸和田市', '豊中市', '池田市', '吹田市', '泉大津市', '高槻市', '貝塚市', '守口市',
      '枚方市', '茨木市', '八尾市', '泉佐野市', '富田林市', '寝屋川市', '河内長野市', '松原市',
      '大東市', '和泉市', '箕面市', '柏原市', '羽曳野市', '門真市', '摂津市', '高石市',
      '藤井寺市', '東大阪市', '泉南市', '四條畷市', '交野市', '大阪狭山市', '阪南市'
    ]
  };

  // 初回自動送信メッセージ
  const defaultWelcomeMessage = `[ワーカー名字]様

この度は、[施設名]の求人にご応募いただき、誠にありがとうございます。
施設長の[施設責任者名字]と申します。

当施設では、働きやすい環境づくりを大切にしております。
初めての方でも安心して勤務いただけるよう、丁寧にサポートいたしますので、
どうぞよろしくお願いいたします。

ご不明な点がございましたら、お気軽にお問い合わせください。
皆様とお会いできることを楽しみにしております。`;

  const [welcomeMessage, setWelcomeMessage] = useState({
    text: '',
    showPreview: false,
  });

  // DBから施設情報を読み込む
  useEffect(() => {
    const loadFacilityInfo = async () => {
      if (!admin?.facilityId) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getFacilityInfo(admin.facilityId);
        if (data) {
          console.log('[loadFacilityInfo] Loaded data:', data);

          // 仮登録状態（is_pending）の場合は空のフォームを表示
          if (data.isPending) {
            console.log('[loadFacilityInfo] Pending facility - showing empty form');
            // デフォルトのstate値をそのまま使用（空のフォーム）
            // 責任者情報のデフォルト値を空にリセット
            setManagerInfo({
              lastName: '',
              firstName: '',
              photo: null,
              photoPreview: '',
              greeting: '',
            });
            // 担当者情報のデフォルト値を空にリセット
            setStaffInfo({
              sameAsManager: false,
              lastName: '',
              firstName: '',
              phone: '',
              emergencyContact: '',
              emails: [''],
            });
            // アクセス情報のデフォルト値を空にリセット
            setAccessInfo({
              stations: [{ name: '', minutes: 0 }],
              accessDescription: '',
              transportation: [],
              parking: '',
              transportationNote: '',
              mapLat: 0,
              mapLng: 0,
              mapImage: '',
            });
            // 初回メッセージのデフォルト値を空にリセット
            setWelcomeMessage((prev) => ({
              ...prev,
              text: defaultWelcomeMessage,
            }));
            setIsLoading(false);
            return;
          }

          // 法人情報をセット
          setCorporateInfo({
            name: data.corporationName || '',
            representativeLastName: data.representativeLastName || '',
            representativeFirstName: data.representativeFirstName || '',
            phone: data.phoneNumber || '',
            prefecture: data.prefecture || '',
            city: data.city || '',
            addressDetail: data.addressDetail || '',
            email: data.email || '',
            contactPersonLastName: data.contactPersonLastName || '',
            contactPersonFirstName: data.contactPersonFirstName || '',
          });

          // 施設情報をセット
          setFacilityInfo({
            name: data.facilityName || '',
            serviceType: data.facilityType || '',
          });

          // 責任者情報をセット
          // blob URLは一時的なURLなので、DBに保存されていても無視する
          // 有効なパス（/uploads/...）のみを使用
          const validPhotoPath = data.managerPhoto && !data.managerPhoto.startsWith('blob:')
            ? data.managerPhoto
            : '';
          setManagerInfo((prev) => ({
            ...prev,
            lastName: data.managerLastName || '',
            firstName: data.managerFirstName || '',
            photo: null, // Fileオブジェクトは常にnullで初期化
            photoPreview: validPhotoPath,
            greeting: data.managerGreeting || '',
          }));

          // 担当者情報をセット
          setStaffInfo({
            sameAsManager: data.staffSameAsManager || false,
            lastName: data.staffLastName || '',
            firstName: data.staffFirstName || '',
            phone: data.staffPhone || '',
            emergencyContact: data.emergencyContact || '',
            emails: data.staffEmails && data.staffEmails.length > 0
              ? data.staffEmails
              : [''],
          });

          // アクセス情報をセット
          setAccessInfo({
            stations: data.stations && data.stations.length > 0
              ? data.stations
              : [{ name: '', minutes: 0 }],
            accessDescription: data.accessDescription || '',
            transportation: data.transportation || [],
            parking: data.parking || '',
            transportationNote: data.transportationNote || '',
            mapLat: data.lat || 0,
            mapLng: data.lng || 0,
            mapImage: data.mapImage || '',
          });

          // 服装情報をセット
          setDresscodeInfo({
            items: data.dresscodeItems || [],
            images: [], // File[]なので、ここでは空配列
          });
          // setExistingDresscodeImages(data.dresscodeImages || []); // 削除

          // 喫煙情報をセット
          setSmokingInfo({
            measure: data.smokingMeasure || '',
            workInSmokingArea: data.workInSmokingArea || '',
          });

          // 住所変更検知用：ロード時の住所を保存
          const loadedAddress = [
            data.prefecture || '',
            data.city || '',
            data.addressDetail || '',
          ].filter(Boolean).join('');
          setOriginalAddress(loadedAddress);

          // 初回メッセージをセット
          setWelcomeMessage((prev) => ({
            ...prev,
            text: data.initialMessage || defaultWelcomeMessage,
          }));
        }
      } catch (error) {
        console.error('Failed to load facility info:', error);
        toast.error('施設情報の読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    loadFacilityInfo();
  }, [admin?.facilityId]);

  // アカウント一覧を読み込む
  useEffect(() => {
    const loadAccounts = async () => {
      if (!admin?.facilityId) return;

      setIsLoadingAccounts(true);
      try {
        const result = await getFacilityAccounts(admin.facilityId);
        if (result.success && result.accounts) {
          setAccounts(result.accounts);
        }
      } catch (error) {
        console.error('Failed to load accounts:', error);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, [admin?.facilityId]);

  const handleManagerPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const result = validateFile(file, 'image');
      if (!result.isValid) {
        toast.error(result.error!);
        return;
      }
      setManagerInfo({
        ...managerInfo,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
    }
  };

  const handleManagerPhotoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleManagerPhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      const file = files[0];
      const result = validateFile(file, 'image');
      if (!result.isValid) {
        toast.error(result.error!);
        return;
      }
      setManagerInfo({
        ...managerInfo,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
    }
  };

  // アカウント追加
  const handleAddAccount = async () => {
    if (!admin?.facilityId) return;
    if (!newAccount.name || !newAccount.email || !newAccount.password) {
      toast.error('すべての項目を入力してください');
      return;
    }

    try {
      const result = await addFacilityAccount(admin.facilityId, newAccount);
      if (result.success && result.account) {
        setAccounts([...accounts, result.account]);
        setShowAddAccountModal(false);
        setNewAccount({ name: '', email: '', password: '' });
        toast.success('アカウントを追加しました');
      } else {
        toast.error(result.error || 'アカウントの追加に失敗しました');
      }
    } catch (error) {
      console.error('Failed to add account:', error);
      toast.error('アカウントの追加に失敗しました');
    }
  };

  // パスワード変更
  const handleChangePassword = async (accountId: number) => {
    if (!admin?.facilityId) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('パスワードは6文字以上で入力してください');
      return;
    }

    try {
      const result = await updateFacilityAccountPassword(accountId, admin.facilityId, newPassword);
      if (result.success) {
        setShowPasswordModal(null);
        setNewPassword('');
        toast.success('パスワードを変更しました');
      } else {
        toast.error(result.error || 'パスワードの変更に失敗しました');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      toast.error('パスワードの変更に失敗しました');
    }
  };

  // アカウント削除
  const handleDeleteAccount = async (accountId: number) => {
    if (!admin?.facilityId) return;
    if (!confirm('このアカウントを削除しますか？')) return;

    try {
      const result = await deleteFacilityAccount(accountId, admin.facilityId);
      if (result.success) {
        setAccounts(accounts.filter(a => a.id !== accountId));
        toast.success('アカウントを削除しました');
      } else {
        toast.error(result.error || 'アカウントの削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error('アカウントの削除に失敗しました');
    }
  };

  const addEmail = () => {
    if (staffInfo.emails.length < 10) {
      setStaffInfo({
        ...staffInfo,
        emails: [...staffInfo.emails, ''],
      });
    }
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...staffInfo.emails];
    newEmails[index] = value;
    setStaffInfo({
      ...staffInfo,
      emails: newEmails,
    });
  };

  const removeEmail = (index: number) => {
    if (staffInfo.emails.length > 1) {
      setStaffInfo({
        ...staffInfo,
        emails: staffInfo.emails.filter((_, i) => i !== index),
      });
    }
  };

  const addStation = () => {
    if (accessInfo.stations.length < 3) {
      setAccessInfo({
        ...accessInfo,
        stations: [...accessInfo.stations, { name: '', minutes: 0 }],
      });
    }
  };

  const updateStation = (index: number, field: 'name' | 'minutes', value: string | number) => {
    const newStations = [...accessInfo.stations];
    newStations[index] = { ...newStations[index], [field]: value };
    setAccessInfo({
      ...accessInfo,
      stations: newStations,
    });
  };

  const removeStation = (index: number) => {
    if (accessInfo.stations.length > 1) {
      setAccessInfo({
        ...accessInfo,
        stations: accessInfo.stations.filter((_, i) => i !== index),
      });
    }
  };

  const previewWelcomeMessage = () => {
    return welcomeMessage.text
      .replace(/\[ワーカー名字\]/g, '田中')
      .replace(/\[施設責任者名字\]/g, managerInfo.lastName)
      .replace(/\[施設名\]/g, facilityInfo.name);
  };

  // 責任者画像のアップロード処理
  const uploadManagerPhoto = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'アップロードに失敗しました');
      }

      const result = await response.json();
      if (result.success && result.urls && result.urls.length > 0) {
        // /uploads/jobs/ から /uploads/manager/ に置き換え（同じ場所でもOK）
        return result.urls[0];
      }
      return null;
    } catch (error) {
      console.error('Manager photo upload error:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    // 二重実行防止
    if (isSaving) {
      return;
    }

    if (!admin?.facilityId) {
      toast.error('施設IDが取得できません');
      console.error('[handleSave] No facilityId. admin:', admin);
      return;
    }

    // Validation
    const errors: string[] = [];

    // 責任者情報
    // 有効な写真: Fileオブジェクトがある、または既にアップロード済みの有効なパスがある
    const hasValidPhoto = managerInfo.photo || (managerInfo.photoPreview && !managerInfo.photoPreview.startsWith('blob:'));
    if (!hasValidPhoto) errors.push('責任者の顔写真は必須です');
    if (!managerInfo.greeting?.trim()) errors.push('責任者の挨拶文は必須です');

    // アクセス
    const validStations = accessInfo.stations.filter(s => s.name?.trim() && (s.minutes || s.minutes === 0));
    if (validStations.length === 0) errors.push('最寄駅は少なくとも1つ入力してください（駅名と所要時間）');

    if (!accessInfo.accessDescription?.trim()) errors.push('アクセスの説明は必須です');
    if (accessInfo.accessDescription && accessInfo.accessDescription.length > 40) errors.push('アクセスの説明は40文字以内で入力してください');

    if (accessInfo.transportation.length === 0) errors.push('移動可能な通勤手段は必須です');
    if (!accessInfo.parking) errors.push('敷地内駐車場は必須です');

    // その他の設定
    if (!smokingInfo.measure) errors.push('受動喫煙防止対策措置は必須です');
    if (!smokingInfo.workInSmokingArea) errors.push('喫煙可能エリアでの作業可否は必須です');

    // 住所は必須
    if (!corporateInfo.prefecture || !corporateInfo.city || !corporateInfo.addressDetail) {
      errors.push('住所（都道府県・市区町村・番地）は必須です');
    }

    // 町名・番地に都道府県や市区町村が含まれていないかチェック
    if (corporateInfo.addressDetail) {
      const addressDetail = corporateInfo.addressDetail;
      // 選択された都道府県・市区町村が町名・番地に含まれていたらエラー
      if (corporateInfo.prefecture && addressDetail.includes(corporateInfo.prefecture)) {
        errors.push(`町名・番地に「${corporateInfo.prefecture}」が含まれています。町名・番地には「●●町1-2-3」のように入力してください`);
      }
      if (corporateInfo.city && addressDetail.includes(corporateInfo.city)) {
        errors.push(`町名・番地に「${corporateInfo.city}」が含まれています。町名・番地には「●●町1-2-3」のように入力してください`);
      }
      // 一般的な都道府県名パターンをチェック
      const prefecturePatterns = ['都', '道', '府', '県'];
      for (const suffix of prefecturePatterns) {
        const pattern = new RegExp(`[\\u4E00-\\u9FFF]+${suffix}`);
        if (pattern.test(addressDetail) && (addressDetail.includes('東京都') || addressDetail.includes('北海道') || addressDetail.includes('京都府') || addressDetail.includes('大阪府') || addressDetail.match(/[\\u4E00-\\u9FFF]+県/))) {
          errors.push('町名・番地に都道府県名が含まれています。町名・番地には「●●町1-2-3」のように入力してください');
          break;
        }
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

    console.log('[handleSave] Saving with facilityId:', admin.facilityId);
    console.log('[handleSave] Full managerInfo state:', JSON.stringify({
      lastName: managerInfo.lastName,
      firstName: managerInfo.firstName,
      photoType: managerInfo.photo ? 'File' : 'null',
      photoName: managerInfo.photo?.name || 'N/A',
      photoPreview: managerInfo.photoPreview,
      greeting: managerInfo.greeting?.substring(0, 50) + '...',
    }));

    setIsSaving(true);
    try {
      // 責任者画像のアップロード処理
      let managerPhotoUrl = managerInfo.photoPreview;

      console.log('[handleSave] managerInfo.photo:', managerInfo.photo);
      console.log('[handleSave] managerInfo.photoPreview:', managerInfo.photoPreview);
      console.log('[handleSave] photo is truthy:', !!managerInfo.photo);

      // 新しいファイルが選択されている場合（Fileオブジェクトがある場合）はアップロード
      if (managerInfo.photo) {
        console.log('[handleSave] Uploading manager photo...');
        try {
          const uploadedUrl = await uploadManagerPhoto(managerInfo.photo);
          console.log('[handleSave] Upload result:', uploadedUrl);
          if (uploadedUrl) {
            managerPhotoUrl = uploadedUrl;
            // アップロード成功後、stateも更新（次回保存時に再アップロードを防ぐ）
            setManagerInfo(prev => ({
              ...prev,
              photo: null,
              photoPreview: uploadedUrl,
            }));
          }
        } catch (uploadError) {
          console.error('Manager photo upload failed:', uploadError);
          toast.error('責任者の顔写真のアップロードに失敗しました');
          setIsSaving(false);
          return;
        }
      }
      // blob URLの場合は既存の画像パスを使用（既にアップロード済みのパスがある場合）
      // blob URLは一時的なので、既存のパスがあればそれを使う
      if (managerPhotoUrl && managerPhotoUrl.startsWith('blob:')) {
        // blob URLしかない場合はエラー（既にアップロードされた画像がない）
        toast.error('責任者の顔写真を再度選択してください');
        setIsSaving(false);
        return;
      }

      // 地図画像の生成（住所が変更された場合、または地図画像がない場合）
      const fullAddress = [
        corporateInfo.prefecture,
        corporateInfo.city,
        corporateInfo.addressDetail,
      ].filter(Boolean).join('');

      const addressChanged = fullAddress !== originalAddress;
      const noMapImage = !accessInfo.mapImage || accessInfo.mapImage.trim() === '';

      let mapImageUrl = accessInfo.mapImage;

      if (fullAddress && (addressChanged || noMapImage)) {
        console.log('[handleSave] Generating map image before save...');
        console.log('[handleSave] Address:', fullAddress, 'Changed:', addressChanged, 'NoMap:', noMapImage);

        try {
          const mapResult = await updateFacilityMapImage(admin.facilityId, fullAddress);
          if (mapResult.success && mapResult.mapImage) {
            mapImageUrl = mapResult.mapImage;
            // stateも更新（UIに反映）
            setAccessInfo(prev => ({ ...prev, mapImage: mapResult.mapImage! }));
            console.log('[handleSave] Map image generated:', mapImageUrl);
          } else {
            // 地図画像の取得に失敗した場合は保存をブロック
            toast.error(
              <div className="text-sm">
                <p className="font-bold mb-1">住所が存在しない可能性があります</p>
                <p>住所を確認して再度保存してください。</p>
                <p className="text-xs mt-1 text-gray-600">入力内容は保持されています。</p>
              </div>,
              { duration: 5000 }
            );
            setIsSaving(false);
            return;
          }
        } catch (mapError) {
          console.error('Failed to generate map image:', mapError);
          toast.error(
            <div className="text-sm">
              <p className="font-bold mb-1">地図画像の生成に失敗しました</p>
              <p>住所を確認して再度保存してください。</p>
              <p className="text-xs mt-1 text-gray-600">入力内容は保持されています。</p>
            </div>,
            { duration: 5000 }
          );
          setIsSaving(false);
          return;
        }
      }

      const result = await updateFacilityBasicInfo(admin.facilityId, {
        // 基本情報
        corporationName: corporateInfo.name,
        facilityName: facilityInfo.name,
        facilityType: facilityInfo.serviceType,
        initialMessage: welcomeMessage.text,

        // 法人情報
        representativeLastName: corporateInfo.representativeLastName,
        representativeFirstName: corporateInfo.representativeFirstName,
        phone: corporateInfo.phone,
        prefecture: corporateInfo.prefecture,
        city: corporateInfo.city,
        addressLine: corporateInfo.addressDetail,
        email: corporateInfo.email,
        contactPersonLastName: corporateInfo.contactPersonLastName,
        contactPersonFirstName: corporateInfo.contactPersonFirstName,

        // 責任者情報
        managerLastName: managerInfo.lastName,
        managerFirstName: managerInfo.firstName,
        managerPhoto: managerPhotoUrl,
        managerGreeting: managerInfo.greeting,

        // 担当者情報
        staffSameAsManager: staffInfo.sameAsManager,
        staffLastName: staffInfo.lastName,
        staffFirstName: staffInfo.firstName,
        staffPhone: staffInfo.phone,
        emergencyContact: staffInfo.emergencyContact,
        staffEmails: staffInfo.emails,

        // アクセス情報
        stations: accessInfo.stations,
        accessDescription: accessInfo.accessDescription,
        transportation: accessInfo.transportation,
        parking: accessInfo.parking,
        transportationNote: accessInfo.transportationNote,
        mapImage: mapImageUrl,

        // 服装情報（画像アップロード処理が別途必要）
        dresscodeItems: dresscodeInfo.items,
        // dresscodeImages: [], // 画像URLの配列を渡す（アップロード後）

        // 喫煙情報
        smokingMeasure: smokingInfo.measure,
        workInSmokingArea: smokingInfo.workInSmokingArea,
      });

      console.log('[handleSave] Result:', result);

      if (result.success) {
        toast.success('保存しました');

        // 新しい住所を「元の住所」として保存（次回の変更検知用）
        setOriginalAddress(fullAddress);

        // 仮登録状態が解除された場合、localStorageのセッションを更新
        if (result.isPendingCleared) {
          try {
            const sessionStr = localStorage.getItem('admin_session');
            if (sessionStr) {
              const session = JSON.parse(sessionStr);
              session.isPending = false;
              localStorage.setItem('admin_session', JSON.stringify(session));
            }
            const legacyStr = localStorage.getItem('currentAdmin');
            if (legacyStr) {
              const legacy = JSON.parse(legacyStr);
              legacy.isPending = false;
              localStorage.setItem('currentAdmin', JSON.stringify(legacy));
            }
            // ページをリロードしてサイドバーを更新
            window.location.reload();
          } catch (e) {
            console.error('Failed to update session:', e);
          }
        }
      } else {
        toast.error(result.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 地図画像を更新
  const handleUpdateMap = async () => {
    if (isUpdatingMap) return;

    if (!admin?.facilityId) {
      toast.error('施設IDが取得できません');
      return;
    }

    // 住所を構築
    const fullAddress = [
      corporateInfo.prefecture,
      corporateInfo.city,
      corporateInfo.addressDetail,
    ].filter(Boolean).join('');

    if (!fullAddress) {
      toast.error('住所を入力してください');
      return;
    }

    setIsUpdatingMap(true);
    try {
      const result = await updateFacilityMapImage(admin.facilityId, fullAddress);

      if (result.success && result.mapImage) {
        setAccessInfo(prev => ({ ...prev, mapImage: result.mapImage! }));
        toast.success('地図画像を更新しました');
      } else {
        toast.error(result.error || '地図画像の取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to update map:', error);
      toast.error('地図画像の更新に失敗しました');
    } finally {
      setIsUpdatingMap(false);
    }
  };

  // ローディング中
  if (isLoading || isAdminLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">施設管理</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">施設管理</h1>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* 法人情報 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">法人情報</h2>
            </div>
            <div className="p-5 space-y-3">
              {/* 法人名と代表者名を一列に */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    法人名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={corporateInfo.name}
                    onChange={(e) => setCorporateInfo({ ...corporateInfo, name: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    代表者名 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={corporateInfo.representativeLastName}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, representativeLastName: e.target.value })}
                      placeholder="姓"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={corporateInfo.representativeFirstName}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, representativeFirstName: e.target.value })}
                      placeholder="名"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 住所入力（AddressSelectorを使用） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  住所 <span className="text-red-500">*</span>
                </label>
                <AddressSelector
                  prefecture={corporateInfo.prefecture}
                  city={corporateInfo.city}
                  addressLine={corporateInfo.addressDetail}
                  building=""
                  postalCode=""
                  onChange={(data) => {
                    setCorporateInfo({
                      ...corporateInfo,
                      prefecture: data.prefecture,
                      city: data.city,
                      addressDetail: data.addressLine || ''
                    });
                  }}
                  showPostalCode={false}
                  showBuilding={false}
                  required={true}
                />
              </div>

              {/* 担当者名、電話番号、メールアドレスを一列に */}
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    担当者名
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={corporateInfo.contactPersonLastName}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, contactPersonLastName: e.target.value })}
                      placeholder="姓"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={corporateInfo.contactPersonFirstName}
                      onChange={(e) => setCorporateInfo({ ...corporateInfo, contactPersonFirstName: e.target.value })}
                      placeholder="名"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    代表電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={corporateInfo.phone}
                    onChange={(e) => setCorporateInfo({ ...corporateInfo, phone: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={corporateInfo.email}
                    onChange={(e) => setCorporateInfo({ ...corporateInfo, email: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 施設情報・担当者 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">施設情報・担当者</h2>
            </div>
            <div className="p-5 space-y-3">
              {/* 施設名とサービス種別を一列に */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    施設名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={facilityInfo.name}
                    onChange={(e) => setFacilityInfo({ ...facilityInfo, name: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    サービス種別 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={facilityInfo.serviceType}
                    onChange={(e) => setFacilityInfo({ ...facilityInfo, serviceType: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    {SERVICE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 責任者情報 */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h3 className="text-sm font-bold text-gray-900 mb-3">責任者</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      氏名 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <input
                        type="text"
                        value={managerInfo.lastName}
                        onChange={(e) => setManagerInfo({ ...managerInfo, lastName: e.target.value })}
                        placeholder="姓"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={managerInfo.firstName}
                        onChange={(e) => setManagerInfo({ ...managerInfo, firstName: e.target.value })}
                        placeholder="名"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      顔写真 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-4">
                      {/* 円形の写真プレビュー */}
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                          {managerInfo.photoPreview ? (
                            <img
                              src={managerInfo.photoPreview}
                              alt="責任者写真"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-12 h-12 text-gray-400" />
                          )}
                        </div>
                        {managerInfo.photoPreview && (
                          <button
                            onClick={() => setManagerInfo({ ...managerInfo, photo: null, photoPreview: '' })}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* 小さなドラッグ&ドロップエリア */}
                      <div
                        onDragOver={handleManagerPhotoDragOver}
                        onDrop={handleManagerPhotoDrop}
                        className="flex-1 max-w-xs border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer"
                      >
                        <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                        <p className="text-xs text-gray-600 mb-1">
                          画像をドラッグ&ドロップ
                        </p>
                        <p className="text-xs text-gray-500 mb-2">または</p>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                          <Upload className="w-3 h-3" />
                          ファイルを選択
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleManagerPhotoUpload}
                            className="hidden"
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">5MB以下 / JPG, PNG, HEIC形式</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      挨拶文 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={managerInfo.greeting}
                      onChange={(e) => setManagerInfo({ ...managerInfo, greeting: e.target.value })}
                      rows={5}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 担当者情報 */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h3 className="text-sm font-bold text-gray-900 mb-3">担当者</h3>

                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={staffInfo.sameAsManager}
                        onChange={(e) => setStaffInfo({ ...staffInfo, sameAsManager: e.target.checked })}
                        className="rounded border-gray-300 text-admin-primary focus:ring-admin-primary"
                      />
                      <span className="text-sm text-gray-700">責任者と同じ</span>
                    </label>
                  </div>

                  {!staffInfo.sameAsManager && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        氏名 <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3 max-w-md">
                        <input
                          type="text"
                          value={staffInfo.lastName}
                          onChange={(e) => setStaffInfo({ ...staffInfo, lastName: e.target.value })}
                          placeholder="姓"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                        />
                        <input
                          type="text"
                          value={staffInfo.firstName}
                          onChange={(e) => setStaffInfo({ ...staffInfo, firstName: e.target.value })}
                          placeholder="名"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      担当電話番号 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={staffInfo.phone}
                      onChange={(e) => setStaffInfo({ ...staffInfo, phone: e.target.value })}
                      className="w-full max-w-xs px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      緊急連絡先
                    </label>
                    <textarea
                      value={staffInfo.emergencyContact}
                      onChange={(e) => setStaffInfo({ ...staffInfo, emergencyContact: e.target.value })}
                      rows={3}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                      placeholder="担当不在の場合は、電話口の者に伝言をお願いいたします。&#10;誰も出ない場合は、下記番号にお電話くださいませ。&#10;大東（ダイトウ）：080-7441-7699"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      担当メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {staffInfo.emails.map((email, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => updateEmail(index, e.target.value)}
                            placeholder={index === 0 ? 'メインアドレス（必須）' : `サブアドレス ${index}`}
                            className="flex-1 max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                          />
                          {index > 0 && (
                            <button
                              onClick={() => removeEmail(index)}
                              className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {staffInfo.emails.length < 10 && (
                        <button
                          onClick={addEmail}
                          className="text-sm text-admin-primary hover:text-admin-primary-dark"
                        >
                          + メールアドレスを追加
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* アカウント管理 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">アカウント管理</h2>
              {accounts.length < 5 && (
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-admin-primary text-white rounded-lg hover:bg-admin-primary-dark"
                >
                  <Plus className="w-4 h-4" />
                  アカウント追加
                </button>
              )}
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                この施設の管理画面にログインできるアカウントを管理します。最大5アカウントまで登録できます。
              </p>

              {isLoadingAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{account.name}</span>
                          {account.is_primary && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              初期アカウント
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{account.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowPasswordModal(account.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          <Key className="w-4 h-4" />
                          パスワード変更
                        </button>
                        {!account.is_primary && (
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {accounts.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      アカウントがありません
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* アクセス */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">アクセス</h2>
            </div>
            <div className="p-5 space-y-3">
              {/* 最寄駅 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最寄駅 <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(最大3つまで / 分も必須)</span>
                </label>
                <div className="space-y-2">
                  {accessInfo.stations.map((station, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={station.name}
                        onChange={(e) => updateStation(index, 'name', e.target.value)}
                        placeholder="駅名を入力"
                        className="flex-1 max-w-xs px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                      />
                      <span className="text-sm text-gray-600">から</span>
                      <input
                        type="number"
                        value={station.minutes || ''}
                        onChange={(e) => updateStation(index, 'minutes', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                      />
                      <span className="text-sm text-gray-600">分</span>
                      {accessInfo.stations.length > 1 && (
                        <button
                          onClick={() => removeStation(index)}
                          className="px-2 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {accessInfo.stations.length < 3 && (
                    <button
                      onClick={addStation}
                      className="text-sm text-admin-primary hover:text-admin-primary-dark"
                    >
                      + 駅を追加
                    </button>
                  )}
                </div>
              </div>

              {/* アクセス説明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  アクセス <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(40文字以内)</span>
                </label>
                <input
                  type="text"
                  value={accessInfo.accessDescription}
                  onChange={(e) => setAccessInfo({ ...accessInfo, accessDescription: e.target.value })}
                  maxLength={40}
                  placeholder="例：恵比寿駅東口より徒歩5分、明治通り沿い"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                />
              </div>

              {/* 移動可能な通勤手段 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  移動可能な通勤手段 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {transportationOptions.map((option) => (
                    <label key={option} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={accessInfo.transportation.includes(option)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAccessInfo({
                              ...accessInfo,
                              transportation: [...accessInfo.transportation, option],
                            });
                          } else {
                            setAccessInfo({
                              ...accessInfo,
                              transportation: accessInfo.transportation.filter((item) => item !== option),
                            });
                          }
                        }}
                        className="rounded border-gray-300 text-admin-primary focus:ring-admin-primary"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 敷地内駐車場 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  敷地内駐車場 <span className="text-red-500">*</span>
                </label>
                <select
                  value={accessInfo.parking}
                  onChange={(e) => setAccessInfo({ ...accessInfo, parking: e.target.value })}
                  className="w-full max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                >
                  {parkingOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* 交通手段の備考 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  交通手段の備考
                </label>
                <textarea
                  value={accessInfo.transportationNote}
                  onChange={(e) => setAccessInfo({ ...accessInfo, transportationNote: e.target.value })}
                  rows={3}
                  placeholder="例：車通勤の場合は事前に申請が必要です"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                />
              </div>

              {/* マップ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  マップ
                </label>
                <div className="space-y-2">
                  <div className="w-full h-64 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center overflow-hidden">
                    {accessInfo.mapImage ? (
                      <img
                        src={accessInfo.mapImage}
                        alt="施設周辺地図"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-gray-500">
                        <p className="text-sm mb-2">地図画像がありません</p>
                        <p className="text-xs">住所を登録後、「地図画像を更新」ボタンで取得できます</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateMap}
                      disabled={isUpdatingMap}
                      className="px-3 py-1.5 text-sm bg-admin-primary text-white rounded-lg hover:bg-admin-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isUpdatingMap ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                      {isUpdatingMap ? '取得中...' : '地図画像を更新'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ※ ピン位置の微調整が必要な場合は、運営サポートまでお問い合わせください
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 服装・受動喫煙防止対策・初回自動送信メッセージ */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">その他の設定</h2>
            </div>
            <div className="p-5 space-y-3">


              {/* 受動喫煙防止対策 */}
              <div className="border-b border-gray-200 pb-3">
                <h3 className="text-sm font-bold text-gray-900 mb-3">受動喫煙防止対策</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      受動喫煙防止対策措置 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={smokingInfo.measure}
                      onChange={(e) => setSmokingInfo({ ...smokingInfo, measure: e.target.value })}
                      className="w-full max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                    >
                      {smokingMeasures.map((measure) => (
                        <option key={measure} value={measure}>
                          {measure}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      喫煙可能エリアでの作業 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="workInSmokingArea"
                          value="有り"
                          checked={smokingInfo.workInSmokingArea === '有り'}
                          onChange={(e) => setSmokingInfo({ ...smokingInfo, workInSmokingArea: e.target.value })}
                          className="border-gray-300 text-admin-primary focus:ring-admin-primary"
                        />
                        <span className="text-sm text-gray-700">有り</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="workInSmokingArea"
                          value="無し"
                          checked={smokingInfo.workInSmokingArea === '無し'}
                          onChange={(e) => setSmokingInfo({ ...smokingInfo, workInSmokingArea: e.target.value })}
                          className="border-gray-300 text-admin-primary focus:ring-admin-primary"
                        />
                        <span className="text-sm text-gray-700">無し</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 初回自動送信メッセージ */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">初回自動送信メッセージ</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                    <p className="mb-1.5">
                      設定しておくと、ワーカーが初めて当施設に応募した際に、ウェルカムメッセージが自動送信されます。
                      ワーカーの初回勤務の不安を軽減することで、キャンセルが発生しにくくなります。
                    </p>
                    <p className="mb-1.5">
                      また、メッセージ本文中では、送信時に変換される以下の変数を利用することができます。
                    </p>
                    <ul className="space-y-0.5 ml-4 text-xs">
                      <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">[ワーカー名字]</code> ワーカーの名字（例: 山田）に変換されます</li>
                      <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">[施設責任者名字]</code> 施設責任者の名字（例: 斉藤）に変換されます</li>
                      <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">[施設名]</code> 施設名（例: カイテク施設）に変換されます</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メッセージ本文
                    </label>
                    <textarea
                      value={welcomeMessage.text}
                      onChange={(e) => setWelcomeMessage({ ...welcomeMessage, text: e.target.value })}
                      rows={8}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                    />
                  </div>

                  <button
                    onClick={() => setWelcomeMessage({ ...welcomeMessage, showPreview: !welcomeMessage.showPreview })}
                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-dark"
                  >
                    <Eye className="w-4 h-4" />
                    {welcomeMessage.showPreview ? 'プレビューを閉じる' : 'プレビューを表示'}
                  </button>

                  {welcomeMessage.showPreview && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1.5">プレビュー</h4>
                      <div className="bg-white rounded-lg p-3 border border-gray-200 whitespace-pre-wrap text-sm">
                        {previewWelcomeMessage()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end gap-3 pb-6">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
      {/* アカウント追加モーダル */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddAccountModal(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">アカウント追加</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  利用者名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  placeholder="例: 山田太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newAccount.email}
                  onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  placeholder="例: yamada@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                  placeholder="6文字以上"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddAccountModal(false);
                  setNewAccount({ name: '', email: '', password: '' });
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddAccount}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-admin-primary rounded-lg hover:bg-admin-primary-dark"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* パスワード変更モーダル */}
      {showPasswordModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPasswordModal(null)}></div>
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">パスワード変更</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-primary focus:border-transparent"
                placeholder="6文字以上"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(null);
                  setNewPassword('');
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleChangePassword(showPasswordModal)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-admin-primary rounded-lg hover:bg-admin-primary-dark"
              >
                変更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
