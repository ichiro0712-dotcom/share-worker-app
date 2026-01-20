'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PDFDownloadButtonProps {
  workerName?: string;
  workDate?: string;
}

export function PrintButton({ workerName, workDate }: PDFDownloadButtonProps = {}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = useCallback(async () => {
    setIsGenerating(true);

    try {
      // PDF化する対象の要素を取得
      const element = document.querySelector('.bg-white.rounded-lg.shadow-sm');
      if (!element) {
        alert('PDF生成に失敗しました。ページを再読み込みしてください。');
        return;
      }

      // html2canvasでHTMLをキャンバスに変換
      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2, // 高解像度
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // A4サイズのPDFを作成
      const imgWidth = 210; // A4の幅 (mm)
      const pageHeight = 297; // A4の高さ (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');

      // 複数ページに対応
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // 最初のページを追加
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // 残りのページを追加
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // ファイル名を生成
      const date = workDate ? new Date(workDate) : new Date();
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const safeName = workerName?.replace(/[/\\?%*:|"<>]/g, '_') || 'worker';
      const filename = `労働条件通知書_${safeName}_${dateStr}.pdf`;

      // PDFをダウンロード
      pdf.save(filename);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert('PDF生成中にエラーが発生しました。ブラウザの印刷機能をお試しください。');
      // フォールバック: ブラウザ印刷
      window.print();
    } finally {
      setIsGenerating(false);
    }
  }, [workerName, workDate]);

  return (
    <button
      className="flex items-center gap-1 text-gray-600 text-sm font-medium disabled:opacity-50"
      onClick={handleDownload}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          生成中...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          PDF保存
        </>
      )}
    </button>
  );
}
