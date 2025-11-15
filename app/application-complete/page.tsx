import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ApplicationComplete() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="flex justify-center mb-6">
          <CheckCircle className="w-20 h-20 text-primary" />
        </div>

        <h1 className="text-xl mb-4 text-gray-900">
          申し込みありがとうございます！
        </h1>

        <p className="text-gray-600 mb-8">
          24時間以内に担当者から連絡致します！
        </p>

        <Link href="/">
          <Button size="lg" className="w-full">
            TOPに戻る
          </Button>
        </Link>
      </div>
    </div>
  );
}
