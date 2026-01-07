# 施設情報DBスキーマ拡張タスク

## 目的
`/admin/facility` ページのフォーム項目をすべてDBに保存・読み込みできるようにする。
現在は一部の項目（法人名、施設名、サービス種別、初回メッセージ）のみがDBに保存されており、
他の項目（代表者名、住所詳細、責任者情報、担当者情報、アクセス情報、服装情報、喫煙情報）は保存されていない。

## 作業の概要
1. Prisma スキーマ (`prisma/schema.prisma`) に新しいカラムを追加
2. マイグレーション実行
3. `src/lib/actions.ts` の `getFacilityInfo` と `updateFacilityBasicInfo` を更新
4. `app/admin/facility/page.tsx` の読み込み・保存処理を更新

---

## Step 1: Prisma スキーマの更新

ファイル: `prisma/schema.prisma`

`model Facility` に以下のカラムを追加してください:

```prisma
model Facility {
  id               Int              @id @default(autoincrement())
  corporation_name String           @map("corporation_name")
  facility_name    String           @map("facility_name")
  facility_type    String           @map("facility_type")
  address          String
  lat              Float
  lng              Float
  phone_number     String           @map("phone_number")
  description      String?
  images           String[]
  map_image        String?          @map("map_image")
  rating           Float            @default(0)
  review_count     Int              @default(0) @map("review_count")
  initial_message  String?          @map("initial_message")
  created_at       DateTime         @default(now()) @map("created_at")
  updated_at       DateTime         @updatedAt @map("updated_at")

  // ========== 以下を追加 ==========

  // 法人情報
  representative_last_name   String?   @map("representative_last_name")
  representative_first_name  String?   @map("representative_first_name")
  prefecture                 String?
  city                       String?
  address_detail             String?   @map("address_detail")
  email                      String?
  contact_person_last_name   String?   @map("contact_person_last_name")
  contact_person_first_name  String?   @map("contact_person_first_name")

  // 責任者情報
  manager_last_name          String?   @map("manager_last_name")
  manager_first_name         String?   @map("manager_first_name")
  manager_photo              String?   @map("manager_photo")
  manager_greeting           String?   @map("manager_greeting")

  // 担当者情報
  staff_same_as_manager      Boolean   @default(false) @map("staff_same_as_manager")
  staff_last_name            String?   @map("staff_last_name")
  staff_first_name           String?   @map("staff_first_name")
  staff_phone                String?   @map("staff_phone")
  emergency_contact          String?   @map("emergency_contact")
  staff_emails               String[]  @default([]) @map("staff_emails")

  // アクセス情報
  stations                   Json?     // [{ name: string, minutes: number }]
  access_description         String?   @map("access_description")
  transportation             String[]  @default([])
  parking                    String?
  transportation_note        String?   @map("transportation_note")

  // 服装情報
  dresscode_items            String[]  @default([]) @map("dresscode_items")
  dresscode_images           String[]  @default([]) @map("dresscode_images")

  // 喫煙情報
  smoking_measure            String?   @map("smoking_measure")
  work_in_smoking_area       String?   @map("work_in_smoking_area")

  // ========== 追加ここまで ==========

  bookmarks        Bookmark[]       @relation("FacilityOwners")
  bookmarkedBy     Bookmark[]       @relation("BookmarkedFacilities")
  admins           FacilityAdmin[]
  jobTemplates     JobTemplate[]
  jobs             Job[]
  sentMessages     Message[]        @relation("FacilitySentMessages")
  receivedMessages Message[]        @relation("FacilityReceivedMessages")
  reviewTemplates  ReviewTemplate[]
  reviews          Review[]

  @@map("facilities")
}
```

---

## Step 2: マイグレーション実行

以下のコマンドを順番に実行:

```bash
# Prisma Client を再生成
npx prisma generate

# データベースにスキーマをプッシュ（開発環境用）
npx prisma db push
```

**注意**: 本番環境では `npx prisma migrate dev --name add_facility_details` を使用してください。

---

## Step 3: actions.ts の更新

ファイル: `src/lib/actions.ts`

### 3-1. getFacilityInfo 関数を以下のように更新:

```typescript
export async function getFacilityInfo(facilityId: number) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
  });

  if (!facility) return null;

  return {
    id: facility.id,
    // 基本情報
    corporationName: facility.corporation_name,
    facilityName: facility.facility_name,
    facilityType: facility.facility_type,
    address: facility.address,
    lat: facility.lat,
    lng: facility.lng,
    phoneNumber: facility.phone_number,
    description: facility.description,
    images: facility.images,
    mapImage: facility.map_image,
    rating: facility.rating,
    reviewCount: facility.review_count,
    initialMessage: facility.initial_message,

    // 法人情報
    representativeLastName: facility.representative_last_name,
    representativeFirstName: facility.representative_first_name,
    prefecture: facility.prefecture,
    city: facility.city,
    addressDetail: facility.address_detail,
    email: facility.email,
    contactPersonLastName: facility.contact_person_last_name,
    contactPersonFirstName: facility.contact_person_first_name,

    // 責任者情報
    managerLastName: facility.manager_last_name,
    managerFirstName: facility.manager_first_name,
    managerPhoto: facility.manager_photo,
    managerGreeting: facility.manager_greeting,

    // 担当者情報
    staffSameAsManager: facility.staff_same_as_manager,
    staffLastName: facility.staff_last_name,
    staffFirstName: facility.staff_first_name,
    staffPhone: facility.staff_phone,
    emergencyContact: facility.emergency_contact,
    staffEmails: facility.staff_emails,

    // アクセス情報
    stations: facility.stations as { name: string; minutes: number }[] | null,
    accessDescription: facility.access_description,
    transportation: facility.transportation,
    parking: facility.parking,
    transportationNote: facility.transportation_note,

    // 服装情報
    dresscodeItems: facility.dresscode_items,
    dresscodeImages: facility.dresscode_images,

    // 喫煙情報
    smokingMeasure: facility.smoking_measure,
    workInSmokingArea: facility.work_in_smoking_area,
  };
}
```

### 3-2. updateFacilityBasicInfo 関数を以下のように更新:

```typescript
export async function updateFacilityBasicInfo(
  facilityId: number,
  data: {
    // 基本情報
    corporationName?: string;
    facilityName?: string;
    facilityType?: string;
    initialMessage?: string;

    // 法人情報
    representativeLastName?: string;
    representativeFirstName?: string;
    phone?: string;
    prefecture?: string;
    city?: string;
    addressDetail?: string;
    email?: string;
    contactPersonLastName?: string;
    contactPersonFirstName?: string;

    // 責任者情報
    managerLastName?: string;
    managerFirstName?: string;
    managerPhoto?: string;
    managerGreeting?: string;

    // 担当者情報
    staffSameAsManager?: boolean;
    staffLastName?: string;
    staffFirstName?: string;
    staffPhone?: string;
    emergencyContact?: string;
    staffEmails?: string[];

    // アクセス情報
    stations?: { name: string; minutes: number }[];
    accessDescription?: string;
    transportation?: string[];
    parking?: string;
    transportationNote?: string;

    // 服装情報
    dresscodeItems?: string[];
    dresscodeImages?: string[];

    // 喫煙情報
    smokingMeasure?: string;
    workInSmokingArea?: string;
  }
) {
  try {
    await prisma.facility.update({
      where: { id: facilityId },
      data: {
        // 基本情報
        corporation_name: data.corporationName,
        facility_name: data.facilityName,
        facility_type: data.facilityType,
        initial_message: data.initialMessage,

        // 法人情報
        representative_last_name: data.representativeLastName,
        representative_first_name: data.representativeFirstName,
        phone_number: data.phone,
        prefecture: data.prefecture,
        city: data.city,
        address_detail: data.addressDetail,
        email: data.email,
        contact_person_last_name: data.contactPersonLastName,
        contact_person_first_name: data.contactPersonFirstName,

        // 責任者情報
        manager_last_name: data.managerLastName,
        manager_first_name: data.managerFirstName,
        manager_photo: data.managerPhoto,
        manager_greeting: data.managerGreeting,

        // 担当者情報
        staff_same_as_manager: data.staffSameAsManager,
        staff_last_name: data.staffLastName,
        staff_first_name: data.staffFirstName,
        staff_phone: data.staffPhone,
        emergency_contact: data.emergencyContact,
        staff_emails: data.staffEmails,

        // アクセス情報
        stations: data.stations,
        access_description: data.accessDescription,
        transportation: data.transportation,
        parking: data.parking,
        transportation_note: data.transportationNote,

        // 服装情報
        dresscode_items: data.dresscodeItems,
        dresscode_images: data.dresscodeImages,

        // 喫煙情報
        smoking_measure: data.smokingMeasure,
        work_in_smoking_area: data.workInSmokingArea,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to update facility:', error);
    return { success: false, error: 'Failed to update facility' };
  }
}
```

---

## Step 4: facility/page.tsx の更新

ファイル: `app/admin/facility/page.tsx`

### 4-1. loadFacilityInfo 内のデータ読み込み処理を更新

`useEffect` の `loadFacilityInfo` 関数内で、DBから取得したデータを各stateにセットする処理を追加:

```typescript
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
        setManagerInfo((prev) => ({
          ...prev,
          lastName: data.managerLastName || '斉藤',
          firstName: data.managerFirstName || '健一',
          photoPreview: data.managerPhoto || '',
          greeting: data.managerGreeting || prev.greeting,
        }));

        // 担当者情報をセット
        setStaffInfo({
          sameAsManager: data.staffSameAsManager || false,
          lastName: data.staffLastName || '田中',
          firstName: data.staffFirstName || '美咲',
          phone: data.staffPhone || '080-1234-5678',
          emergencyContact: data.emergencyContact || `担当不在の場合は、電話口の者に伝言をお願いいたします。
誰も出ない場合は、下記番号にお電話くださいませ。
大東（ダイトウ）：080-7441-7699`,
          emails: data.staffEmails && data.staffEmails.length > 0
            ? data.staffEmails
            : ['tanaka@caretech.co.jp'],
        });

        // アクセス情報をセット
        setAccessInfo({
          stations: data.stations && data.stations.length > 0
            ? data.stations
            : [{ name: '恵比寿駅', minutes: 5 }],
          accessDescription: data.accessDescription || '恵比寿駅東口より徒歩5分、明治通り沿い',
          transportation: data.transportation || [],
          parking: data.parking || '',
          transportationNote: data.transportationNote || '',
          mapLat: data.lat || 35.6465,
          mapLng: data.lng || 139.7102,
          mapImage: data.mapImage || '',
        });

        // 服装情報をセット（画像はURL文字列として扱う）
        setDresscodeInfo({
          items: data.dresscodeItems || [],
          images: [], // File[]なので、ここでは空配列。既存画像は別途表示ロジックが必要
        });

        // 喫煙情報をセット
        setSmokingInfo({
          measure: data.smokingMeasure || '',
          workInSmokingArea: data.workInSmokingArea || '',
        });

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
```

### 4-2. handleSave 関数を更新

保存時にすべての項目をサーバーに送信:

```typescript
const handleSave = async () => {
  if (isSaving) return;

  if (!admin?.facilityId) {
    toast.error('施設IDが取得できません');
    console.error('[handleSave] No facilityId. admin:', admin);
    return;
  }

  console.log('[handleSave] Saving with facilityId:', admin.facilityId);

  setIsSaving(true);
  try {
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
      addressDetail: corporateInfo.addressDetail,
      email: corporateInfo.email,
      contactPersonLastName: corporateInfo.contactPersonLastName,
      contactPersonFirstName: corporateInfo.contactPersonFirstName,

      // 責任者情報
      managerLastName: managerInfo.lastName,
      managerFirstName: managerInfo.firstName,
      managerPhoto: managerInfo.photoPreview, // 注: 画像アップロード処理が別途必要
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
```

---

## Step 5: 服装画像の表示対応（オプション）

服装画像（`dresscodeInfo.images`）は現在 `File[]` 型で管理されていますが、DBには文字列（URL）として保存されます。
既存の保存済み画像を表示するには、以下の対応が必要です：

### 5-1. 既存画像用のstateを追加

```typescript
// 既存の服装画像URL
const [existingDresscodeImages, setExistingDresscodeImages] = useState<string[]>([]);
```

### 5-2. loadFacilityInfo で既存画像をセット

```typescript
// 服装情報をセット
setExistingDresscodeImages(data.dresscodeImages || []);
```

### 5-3. 画像表示部分を更新

```tsx
{/* 既存画像の表示 */}
{existingDresscodeImages.length > 0 && (
  <div className="grid grid-cols-4 gap-2 mb-2">
    {existingDresscodeImages.map((url, index) => (
      <div key={`existing-${index}`} className="relative aspect-video">
        <img
          src={url}
          alt={`服装サンプル${index + 1}`}
          className="absolute inset-0 w-full h-full object-cover rounded-lg border border-gray-200"
        />
        <button
          onClick={() => {
            setExistingDresscodeImages(existingDresscodeImages.filter((_, i) => i !== index));
          }}
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
)}

{/* 新規アップロード画像の表示 */}
{dresscodeInfo.images.length > 0 && (
  <div className="grid grid-cols-4 gap-2">
    {dresscodeInfo.images.map((file, index) => (
      // ... 既存コード
    ))}
  </div>
)}
```

---

## 作業完了後チェックリスト（必須）

以下を順番に実行してください：

### 1. キャッシュクリアと再ビルド
tailwind.config.ts、globals.css、その他スタイル関連ファイルを変更した場合：
```bash
rm -rf .next && npm run build
```

### 2. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 3. 開発サーバー再起動
```bash
# 既存のサーバーを停止してから
rm -rf .next && npm run dev
```

### 4. ブラウザ確認
- ハードリロード（Cmd+Shift+R または Ctrl+Shift+R）で確認
- DevToolsのNetworkタブで「Disable cache」をチェックして確認

### 5. 動作確認
1. `/admin/facility` ページを開く
2. 各項目にデータを入力
3. 「保存する」ボタンをクリック
4. ページをリロードして、入力したデータが残っているか確認

### 6. 変更ファイルの報告
変更したファイル一覧を報告すること：
- `prisma/schema.prisma`
- `src/lib/actions.ts`
- `app/admin/facility/page.tsx`

---

## 注意事項

1. **画像アップロード**: 責任者写真や服装サンプル画像のアップロード処理は現在未実装です。
   画像はblob URLとして表示されていますが、実際にサーバーに保存する処理が必要です。
   既存の `/api/upload/route.ts` を使用してください。

2. **住所の同期**: `address` カラムはすでに存在します。`prefecture`, `city`, `address_detail` の
   データから `address` を構築するか、個別に管理するかを決める必要があります。

3. **エラーハンドリング**: 各入力項目のバリデーションは最小限です。必要に応じて追加してください。
