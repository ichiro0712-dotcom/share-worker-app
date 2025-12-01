'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getReceivedReviews } from '@/src/lib/actions';

interface ReceivedReview {
    id: number;
    facilityName: string;
    jobTitle: string;
    workDate: string;
    rating: number;
    ratings: {
        attendance: number;
        skill: number;
        execution: number;
        communication: number;
        attitude: number;
    };
    comment: string | null;
    createdAt: string;
}

export default function ReceivedReviewsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuth();
    const [reviews, setReviews] = useState<ReceivedReview[]>([]);
    const [isPageLoading, setIsPageLoading] = useState(true);

    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated || !user) {
            router.push('/login');
        }
    }, [isAuthenticated, user, isLoading, router]);

    useEffect(() => {
        const fetchReviews = async () => {
            if (!user?.id) return;
            setIsPageLoading(true);
            try {
                const userId = parseInt(user.id, 10);
                if (!isNaN(userId)) {
                    const data = await getReceivedReviews(userId);
                    setReviews(data);
                }
            } catch (error) {
                console.error('Failed to fetch reviews:', error);
            } finally {
                setIsPageLoading(false);
            }
        };
        fetchReviews();
    }, [user?.id]);

    const RATING_LABELS = [
        { key: 'attendance', label: '勤怠・時間' },
        { key: 'skill', label: 'スキル' },
        { key: 'execution', label: '遂行力' },
        { key: 'communication', label: 'コミュ力' },
        { key: 'attitude', label: '姿勢' },
    ];

    if (!isAuthenticated || !user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 py-6">
                <h1 className="text-xl font-bold mb-6">受けた評価</h1>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center shadow-sm">
                        <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">まだ評価を受けていません</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div key={review.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                                {/* ヘッダー: 施設名・日付 */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg">
                                            <Building2 className="w-5 h-5 text-gray-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{review.facilityName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{review.jobTitle}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                勤務日: {new Date(review.workDate).toLocaleDateString('ja-JP')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                        <span className="font-bold text-yellow-700">{review.rating.toFixed(1)}</span>
                                    </div>
                                </div>

                                {/* 5項目評価チャート */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-4 p-4 bg-gray-50 rounded-lg">
                                    {RATING_LABELS.map((item) => (
                                        <div key={item.key} className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500 w-16">{item.label}</span>
                                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-yellow-400"
                                                    style={{ width: `${(review.ratings[item.key as keyof typeof review.ratings] || 0) * 20}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-gray-700 w-4 text-right">
                                                {review.ratings[item.key as keyof typeof review.ratings]}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* コメント */}
                                {review.comment && (
                                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                        {review.comment}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
