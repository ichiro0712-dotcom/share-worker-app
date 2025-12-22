import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-4">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-gray-500">応募履歴を読み込み中...</p>
            </div>
        </div>
    );
}
