'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, AlertTriangle, FileText, Heart, Ban, X, Plus, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useDebugError, extractDebugInfo } from '@/components/debug/DebugErrorBanner';

import { getPendingWorkerReviews, getCompletedWorkerReviews, submitWorkerReviewByJob, getReviewTemplates, createReviewTemplate, updateReviewTemplate, deleteReviewTemplate } from '@/src/lib/actions';

// 評価項目の定義
const RATING_CATEGORIES = [
    { key: 'attendance', label: '勤怠・時間', description: '始業・休憩・終業等の時間をきちんと守れていましたか？' },
    { key: 'skill', label: 'スキル', description: '業務に関わる技術はもちあわせていましたか？' },
    { key: 'execution', label: '遂行力', description: '必要な業務を遂行できましたか？' },
    { key: 'communication', label: 'コミュ力', description: '業務上必要なコミュニケーションレベルに達していましたか？' },
    { key: 'attitude', label: '姿勢', description: '不適切な態度などなく業務を遂行できましたか？' },
];

interface PendingReview {
    applicationId: number;
    jobId: number; // 追加
    userId: number;
    userName: string;
    userProfileImage: string | null;
    jobTitle: string;
    workDate: string;
    startTime: string;
    endTime: string;
    daysSinceWork: number; // 勤務日からの経過日数
}

interface ReviewTemplate {
    id: number;
    name: string;
    content: string;
}

export default function WorkerReviewsPage() {
    const router = useRouter();
    const { showDebugError } = useDebugError();
    const { admin, isAdmin, isAdminLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
    const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
    const [completedReviews, setCompletedReviews] = useState<any[]>([]);
    const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // モーダル状態
    const [selectedApplication, setSelectedApplication] = useState<PendingReview | null>(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    // 評価入力状態
    const [ratings, setRatings] = useState({
        attendance: 5,
        skill: 5,
        execution: 5,
        communication: 5,
        attitude: 5,
    });
    const [comment, setComment] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

    // テンプレート編集状態
    const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState('');
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

    // 認証チェック
    useEffect(() => {
        if (isAdminLoading) return;
        if (!isAdmin || !admin) {
            router.push('/admin/login');
        }
    }, [isAdmin, admin, isAdminLoading, router]);

    // データ取得
    useEffect(() => {
        // AdminLoadingが完了するまで待つ
        if (isAdminLoading) {
            console.log('[worker-reviews] Still loading admin, waiting...');
            return;
        }

        const fetchData = async () => {
            console.log('[worker-reviews] admin:', admin);
            console.log('[worker-reviews] facilityId:', admin?.facilityId);
            if (!admin?.facilityId) {
                console.log('[worker-reviews] No facilityId, skipping fetch');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                // ステータス更新をトリガー
                await fetch('/api/cron/update-statuses');

                console.log('[worker-reviews] Fetching pending reviews for facilityId:', admin.facilityId);
                const pending = await getPendingWorkerReviews(admin.facilityId);
                console.log('[worker-reviews] Pending reviews:', pending);
                const completed = await getCompletedWorkerReviews(admin.facilityId);
                console.log('[worker-reviews] Completed reviews:', completed);

                setPendingReviews(pending as PendingReview[]);
                setCompletedReviews(completed);

                // テンプレート取得
                const templateData = await getReviewTemplates(admin.facilityId);
                setTemplates(templateData as ReviewTemplate[]);
            } catch (error) {
                const debugInfo = extractDebugInfo(error);
                showDebugError({
                    type: 'fetch',
                    operation: 'ワーカーレビューデータ取得',
                    message: debugInfo.message,
                    details: debugInfo.details,
                    stack: debugInfo.stack,
                    context: { facilityId: admin.facilityId }
                });
                console.error('Failed to fetch data:', error);
                toast.error('データの取得に失敗しました');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [admin?.facilityId, isAdminLoading]);

    // テンプレートの再取得
    const refreshTemplates = async () => {
        if (!admin?.facilityId) return;
        const templateData = await getReviewTemplates(admin.facilityId);
        setTemplates(templateData as ReviewTemplate[]);
    };

    // テンプレート作成
    const handleCreateTemplate = async () => {
        if (!admin?.facilityId || !newTemplateName.trim() || !newTemplateContent.trim()) {
            toast.error('タイトルと内容を入力してください');
            return;
        }
        try {
            await createReviewTemplate(admin.facilityId, newTemplateName.trim(), newTemplateContent.trim());
            toast.success('テンプレートを作成しました');
            setNewTemplateName('');
            setNewTemplateContent('');
            setIsCreatingTemplate(false);
            await refreshTemplates();
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'save',
                operation: 'レビューテンプレート作成',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { facilityId: admin.facilityId, name: newTemplateName.trim() }
            });
            console.error('Failed to create template:', error);
            toast.error('テンプレートの作成に失敗しました');
        }
    };

    // テンプレート更新
    const handleUpdateTemplate = async () => {
        if (!admin?.facilityId || !editingTemplate || !newTemplateName.trim() || !newTemplateContent.trim()) {
            toast.error('タイトルと内容を入力してください');
            return;
        }
        try {
            const result = await updateReviewTemplate(editingTemplate.id, newTemplateName.trim(), newTemplateContent.trim(), admin.facilityId);
            if (result.success) {
                toast.success('テンプレートを更新しました');
                setEditingTemplate(null);
                setNewTemplateName('');
                setNewTemplateContent('');
                await refreshTemplates();
            } else {
                toast.error(result.error || 'テンプレートの更新に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'update',
                operation: 'レビューテンプレート更新',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { templateId: editingTemplate.id, name: newTemplateName.trim() }
            });
            console.error('Failed to update template:', error);
            toast.error('テンプレートの更新に失敗しました');
        }
    };

    // テンプレート削除
    const handleDeleteTemplate = async (templateId: number) => {
        if (!admin?.facilityId) return;
        if (!confirm('このテンプレートを削除しますか？')) return;
        try {
            const result = await deleteReviewTemplate(templateId, admin.facilityId);
            if (result.success) {
                toast.success('テンプレートを削除しました');
                await refreshTemplates();
            } else {
                toast.error(result.error || 'テンプレートの削除に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'delete',
                operation: 'レビューテンプレート削除',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { templateId }
            });
            console.error('Failed to delete template:', error);
            toast.error('テンプレートの削除に失敗しました');
        }
    };

    // レビュー投稿
    const handleSubmitReview = async (action: 'submit' | 'favorite' | 'block') => {
        if (!selectedApplication || !admin) return;

        try {
            const result = await submitWorkerReviewByJob({
                jobId: selectedApplication.jobId,
                userId: selectedApplication.userId,
                facilityId: admin.facilityId,
                ratings,
                comment,
                action: action === 'submit' ? undefined : action,
            });

            if (result.success) {
                toast.success('レビューを登録しました');
                setSelectedApplication(null);
                // 評価をリセット
                setRatings({
                    attendance: 5,
                    skill: 5,
                    execution: 5,
                    communication: 5,
                    attitude: 5,
                });
                setComment('');
                // リストを更新
                const pending = await getPendingWorkerReviews(admin.facilityId);
                const completed = await getCompletedWorkerReviews(admin.facilityId);
                setPendingReviews(pending as PendingReview[]);
                setCompletedReviews(completed);
            } else {
                toast.error(result.error || 'レビューの登録に失敗しました');
            }
        } catch (error) {
            const debugInfo = extractDebugInfo(error);
            showDebugError({
                type: 'save',
                operation: 'ワーカーレビュー投稿(モーダル)',
                message: debugInfo.message,
                details: debugInfo.details,
                stack: debugInfo.stack,
                context: { jobId: selectedApplication.jobId, userId: selectedApplication.userId, facilityId: admin.facilityId, action }
            });
            console.error('Failed to submit review:', error);
            toast.error('レビューの登録に失敗しました');
        }
    };

    // 星評価コンポーネント
    const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    className="focus:outline-none"
                >
                    <Star
                        className={`w-6 h-6 transition-colors ${star <= value ? 'text-yellow-400 fill-current' : 'text-gray-300'
                            }`}
                    />
                </button>
            ))}
        </div>
    );

    if (!isAdmin || !admin) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="px-6 py-4">
                    <h1 className="text-xl font-bold">ワーカーレビュー</h1>
                    <p className="text-sm text-gray-600 mt-1">ワーカーへの評価を管理します</p>
                </div>

                {/* タブ */}
                <div className="px-6 flex gap-4 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        未入力 ({pendingReviews.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'completed'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        入力済み ({completedReviews.length})
                    </button>
                </div>
            </div>

            {/* コンテンツ */}
            <div className="p-6">
                {activeTab === 'pending' && (
                    <div className="space-y-4">
                        {pendingReviews.length === 0 ? (
                            <div className="bg-white rounded-lg p-8 text-center">
                                <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">未入力のレビューはありません</p>
                            </div>
                        ) : (
                            pendingReviews.map((review) => (
                                <div
                                    key={review.applicationId}
                                    className={`bg-white rounded-lg border p-4 ${review.daysSinceWork >= 3 ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* プロフィール画像 */}
                                            <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                                                {review.userProfileImage ? (
                                                    <img src={review.userProfileImage} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                                                        {review.userName.charAt(0)}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{review.userName}</span>
                                                    {review.daysSinceWork >= 3 && (
                                                        <span className="flex items-center gap-1 text-red-600 text-xs">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            {review.daysSinceWork}日経過
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600">{review.jobTitle}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(review.workDate).toLocaleDateString('ja-JP')} {review.startTime}-{review.endTime}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setSelectedApplication(review)}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                        >
                                            レビューを入力
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'completed' && (
                    <div className="space-y-4">
                        {completedReviews.length === 0 ? (
                            <div className="bg-white rounded-lg p-8 text-center">
                                <p className="text-gray-600">入力済みのレビューはありません</p>
                            </div>
                        ) : (
                            completedReviews.map((review) => (
                                <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                            {review.userProfileImage ? (
                                                <img src={review.userProfileImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                                                    {review.userName.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold">{review.userName}</p>
                                            <p className="text-sm text-gray-600">{review.jobTitle}</p>
                                        </div>
                                        <div className="ml-auto flex items-center gap-1">
                                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                            <span className="font-bold">{review.rating}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                                        {review.comment}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2 text-right">
                                        {new Date(review.createdAt).toLocaleDateString('ja-JP')}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* レビュー入力モーダル */}
            {selectedApplication && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedApplication(null)} />
                    <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        {/* モーダルヘッダー */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-lg font-bold">レビュー入力</h2>
                            <button onClick={() => setSelectedApplication(null)}>
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* ワーカー情報 */}
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                    {selectedApplication.userProfileImage ? (
                                        <img src={selectedApplication.userProfileImage} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                                            {selectedApplication.userName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold">{selectedApplication.userName}</p>
                                    <p className="text-sm text-gray-600">{selectedApplication.jobTitle}</p>
                                </div>
                            </div>
                        </div>

                        {/* 評価入力 */}
                        <div className="px-6 py-4">
                            {/* 注意書き */}
                            <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                    減点採点になります。問題点がない場合は5点を記載してください。
                                </p>
                            </div>

                            {/* 5項目の評価 */}
                            <div className="space-y-6">
                                {RATING_CATEGORIES.map((category) => (
                                    <div key={category.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium">{category.label}</span>
                                            <StarRating
                                                value={ratings[category.key as keyof typeof ratings]}
                                                onChange={(v) => setRatings(prev => ({ ...prev, [category.key]: v }))}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500">{category.description}</p>
                                    </div>
                                ))}
                            </div>

                            {/* コメント入力 */}
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="font-medium">コメント</label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={selectedTemplateId || ''}
                                            onChange={(e) => {
                                                const id = Number(e.target.value);
                                                setSelectedTemplateId(id || null);
                                                const template = templates.find(t => t.id === id);
                                                if (template) setComment(template.content);
                                            }}
                                            className="text-sm border border-gray-300 rounded px-2 py-1"
                                        >
                                            <option value="">テンプレートから選択</option>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => setShowTemplateModal(true)}
                                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            <FileText className="w-4 h-4" />
                                            編集
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="良かった点などを具体的に記入すると、また働きたいと思われてもらいやすいです"
                                    className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                                />
                            </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
                            <div className="space-y-2">
                                {/* 1行目：レビュー登録 + キャンセル */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleSubmitReview('submit')}
                                        className="px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                    >
                                        レビュー登録
                                    </button>
                                    <button
                                        onClick={() => setSelectedApplication(null)}
                                        className="px-4 py-3 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200"
                                    >
                                        キャンセル
                                    </button>
                                </div>

                                {/* 2行目：お気に入り + ブロック */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleSubmitReview('favorite')}
                                        className="px-3 py-2.5 bg-pink-50 text-pink-700 border border-pink-200 text-sm font-medium rounded-lg hover:bg-pink-100 flex items-center justify-center gap-1.5"
                                    >
                                        <Heart className="w-4 h-4" />
                                        お気に入りして登録
                                    </button>
                                    <button
                                        onClick={() => handleSubmitReview('block')}
                                        className="px-3 py-2.5 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-lg hover:bg-red-100 flex items-center justify-center gap-1.5"
                                    >
                                        <Ban className="w-4 h-4" />
                                        ブロックして登録
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* テンプレート編集モーダル */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => {
                        setShowTemplateModal(false);
                        setEditingTemplate(null);
                        setIsCreatingTemplate(false);
                        setNewTemplateName('');
                        setNewTemplateContent('');
                    }} />
                    <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold">テンプレート管理</h2>
                            <button onClick={() => {
                                setShowTemplateModal(false);
                                setEditingTemplate(null);
                                setIsCreatingTemplate(false);
                                setNewTemplateName('');
                                setNewTemplateContent('');
                            }}>
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* 新規作成/編集フォーム */}
                            {(isCreatingTemplate || editingTemplate) && (
                                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <h3 className="text-sm font-bold text-gray-900">
                                        {editingTemplate ? 'テンプレートを編集' : '新規テンプレート作成'}
                                    </h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            タイトル
                                        </label>
                                        <input
                                            type="text"
                                            value={newTemplateName}
                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                            placeholder="例：良い評価テンプレート"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            内容
                                        </label>
                                        <textarea
                                            value={newTemplateContent}
                                            onChange={(e) => setNewTemplateContent(e.target.value)}
                                            placeholder="テンプレートの内容を入力..."
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => {
                                                setEditingTemplate(null);
                                                setIsCreatingTemplate(false);
                                                setNewTemplateName('');
                                                setNewTemplateContent('');
                                            }}
                                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                                            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            {editingTemplate ? '更新' : '作成'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 新規作成ボタン */}
                            {!isCreatingTemplate && !editingTemplate && (
                                <button
                                    onClick={() => setIsCreatingTemplate(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    新規テンプレートを作成
                                </button>
                            )}

                            {/* テンプレート一覧 */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-gray-700">保存済みテンプレート</h3>
                                {templates.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">
                                        テンプレートはまだありません
                                    </p>
                                ) : (
                                    templates.map((template) => (
                                        <div
                                            key={template.id}
                                            className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <span className="font-medium text-gray-900">{template.name}</span>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditingTemplate(template);
                                                            setNewTemplateName(template.name);
                                                            setNewTemplateContent(template.content);
                                                            setIsCreatingTemplate(false);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        title="編集"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTemplate(template.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="削除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 line-clamp-2">{template.content}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
