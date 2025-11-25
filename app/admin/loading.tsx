import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-lg shadow-md">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-600">管理者データを読み込んでいます...</p>
      </div>
    </div>
  );
}
