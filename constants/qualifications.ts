/**
 * 資格関連の定数定義
 * ワーカー保有資格・求人資格条件で共通使用
 */

// 資格グループ定義
export const QUALIFICATION_GROUPS = [
    {
        name: '介護系資格',
        qualifications: [
            '介護福祉士',
            '認定介護福祉士',
            '実務者研修',
            '初任者研修',
            '介護職員基礎研修',
            'ヘルパー1級',
            'ヘルパー2級',
            '介護支援専門員',
            '認知症介護基礎研修',
            '認知症介護実践者研修',
            '認知症介護実践リーダー研修',
            '喀痰吸引等研修',
            '福祉用具専門相談員',
            'レクリエーション介護士1級',
            'レクリエーション介護士2級',
        ],
    },
    {
        name: '障害福祉系資格',
        qualifications: [
            '重度訪問介護従業者養成研修 基礎課程',
            '重度訪問介護従業者養成研修 追加課程',
            '同行援護従事者養成研修',
            '行動援護従事者養成研修',
            '全身性障害者ガイドヘルパー養成研修',
            '難病患者等ホームヘルパー養成研修 基礎課程I',
            '難病患者等ホームヘルパー養成研修 基礎課程II',
        ],
    },
    {
        name: '看護系資格',
        qualifications: [
            '看護師',
            '准看護師',
            '認定看護師',
            '専門看護師',
            '保健師',
            '助産師',
            '看護助手認定実務者',
        ],
    },
    {
        name: 'リハビリ系資格',
        qualifications: [
            '理学療法士',
            '作業療法士',
            '言語聴覚士',
            '柔道整復師',
            'あん摩マッサージ指圧師',
            'はり師',
            'きゅう師',
        ],
    },
    {
        name: '福祉相談系資格',
        qualifications: [
            '社会福祉士',
            '社会福祉主事',
            '精神保健福祉士',
        ],
    },
    {
        name: '医療系資格',
        qualifications: [
            '医師',
            '薬剤師',
            '保険薬剤師登録票',
            '歯科衛生士',
            '管理栄養士',
            '栄養士',
            '調理師',
            '医療事務認定実務者',
        ],
    },
    {
        name: 'その他',
        qualifications: [
            '保育士',
            'ドライバー(運転免許証)',
        ],
    },
] as const;

// フラットな資格リスト（ワーカー用：証明書アップロード対象）
export const WORKER_QUALIFICATIONS = QUALIFICATION_GROUPS.flatMap(
    (group) => group.qualifications
);

// 求人用資格条件（ワーカー資格 + 無資格可）
export const JOB_QUALIFICATION_OPTIONS = [
    ...WORKER_QUALIFICATIONS,
    '無資格可',
] as const;

// 型定義
export type WorkerQualification = typeof WORKER_QUALIFICATIONS[number];
export type JobQualificationOption = typeof JOB_QUALIFICATION_OPTIONS[number];
