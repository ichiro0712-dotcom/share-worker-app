import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { validateFacilityAccess } from '@/lib/admin-session-server';

/**
 * POST /api/admin/labor-documents/request
 * 労働条件通知書のダウンロードリクエストを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      facilityId,
      workerId,
      startDate,
      endDate,
      includeQualifications,
      email,
    } = body;

    // バリデーション
    if (!facilityId || !workerId || !startDate || !endDate || !email) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      );
    }

    // セッション認証チェック
    const { valid, session, error } = await validateFacilityAccess(facilityId);
    if (!valid || !session) {
      if (error === 'unauthorized') {
        return NextResponse.json(
          { error: '認証が必要です', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: '権限がありません', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const adminId = session.adminId!;

    // 管理者情報を取得（施設名取得用）
    const admin = await prisma.facilityAdmin.findUnique({
      where: { id: adminId },
      include: {
        facility: {
          select: {
            facility_name: true,
          },
        },
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: '管理者情報が見つかりません' },
        { status: 404 }
      );
    }

    // ワーカーがこの施設で勤務したことがあるか確認
    const hasWorked = await prisma.application.findFirst({
      where: {
        user_id: workerId,
        workDate: {
          job: { facility_id: facilityId },
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
    });

    if (!hasWorked) {
      return NextResponse.json(
        { error: 'このワーカーはこの施設で勤務していません' },
        { status: 400 }
      );
    }

    // トークンを生成（URLセーフなランダム文字列）
    const token = randomBytes(32).toString('base64url');

    // 有効期限（72時間後）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    // ダウンロードトークンを作成
    const downloadToken = await prisma.laborDocumentDownloadToken.create({
      data: {
        token,
        facility_admin_id: adminId,
        worker_id: workerId,
        facility_id: facilityId,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        include_qualifications: includeQualifications || false,
        email,
        expires_at: expiresAt,
        status: 'PENDING',
      },
    });

    // バックグラウンドでZIP生成を開始（非同期）
    // 注意: 本番環境ではキューシステム（Bull, SQSなど）を使用することを推奨
    generateZipAsync(downloadToken.id).catch(console.error);

    // ダウンロードURLを生成
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const downloadUrl = `${baseUrl}/api/download/labor-docs/${token}`;

    return NextResponse.json({
      success: true,
      token,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
      facilityName: admin.facility?.facility_name || '施設',
      message: '処理を開始しました。完了次第メールでお知らせします。',
    });
  } catch (error) {
    console.error('[POST /api/admin/labor-documents/request] Error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * バックグラウンドでZIPファイルを生成
 */
async function generateZipAsync(tokenId: number) {
  const archiver = await import('archiver');
  const fs = await import('fs/promises');
  const path = await import('path');
  const { generateLaborDocumentPdf, generateLaborDocumentFilename } = await import('@/src/lib/laborDocumentPdf');

  try {
    // トークン情報を取得
    const tokenRecord = await prisma.laborDocumentDownloadToken.findUnique({
      where: { id: tokenId },
    });

    if (!tokenRecord) {
      throw new Error('Token not found');
    }

    // 対象期間内のマッチング済み応募を取得
    const applications = await prisma.application.findMany({
      where: {
        user_id: tokenRecord.worker_id,
        workDate: {
          job: { facility_id: tokenRecord.facility_id },
          work_date: {
            gte: tokenRecord.start_date,
            lte: tokenRecord.end_date,
          },
        },
        status: {
          in: ['SCHEDULED', 'WORKING', 'COMPLETED_PENDING', 'COMPLETED_RATED'],
        },
      },
      include: {
        user: true,
        workDate: {
          include: {
            job: {
              include: {
                facility: true,
                template: true,
              },
            },
          },
        },
      },
      orderBy: {
        workDate: {
          work_date: 'asc',
        },
      },
    });

    if (applications.length === 0) {
      await prisma.laborDocumentDownloadToken.update({
        where: { id: tokenId },
        data: {
          status: 'FAILED',
          error_message: '対象期間内に勤務データがありません',
        },
      });
      return;
    }

    // 出力ディレクトリを確保
    const uploadsDir = path.default.join(process.cwd(), 'public', 'uploads', 'labor-docs');
    await fs.mkdir(uploadsDir, { recursive: true });

    // ZIPファイルのパスを生成
    const zipFilename = `labor_docs_${tokenRecord.worker_id}_${Date.now()}.zip`;
    const zipPath = path.default.join(uploadsDir, zipFilename);
    const zipRelativePath = `/uploads/labor-docs/${zipFilename}`;

    // ZIPアーカイブを作成
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver.default('zip', {
      zlib: { level: 9 },
    });

    const archivePromise = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // 各応募に対してPDFを生成してZIPに追加
    for (const application of applications) {
      const job = application.workDate.job;
      const facility = job.facility;
      const template = job.template;

      const laborDocData = {
        application: {
          id: application.id,
          status: application.status,
          work_date: application.workDate.work_date.toISOString(),
          created_at: application.created_at.toISOString(),
        },
        user: {
          id: application.user.id,
          name: application.user.name,
        },
        job: {
          id: job.id,
          title: job.title,
          start_time: job.start_time,
          end_time: job.end_time,
          break_time: parseInt(job.break_time) || 0,
          wage: job.wage,
          hourly_wage: job.hourly_wage,
          transportation_fee: job.transportation_fee,
          address: job.address,
          overview: job.overview,
          work_content: job.work_content,
          belongings: job.belongings,
        },
        facility: {
          id: facility.id,
          corporation_name: facility.corporation_name,
          facility_name: facility.facility_name,
          address: facility.address,
          prefecture: facility.prefecture,
          city: facility.city,
          address_detail: facility.address_detail,
          smoking_measure: facility.smoking_measure,
        },
        dismissalReasons: template?.dismissal_reasons || null,
      };

      // PDFを生成
      const pdfBuffer = await generateLaborDocumentPdf(laborDocData);
      const pdfFilename = generateLaborDocumentFilename(
        application.user.name,
        application.workDate.work_date.toISOString(),
        application.id
      );

      // ZIPに追加
      archive.append(pdfBuffer, { name: `労働条件通知書/${pdfFilename}` });
    }

    // 資格証明書を含める場合
    if (tokenRecord.include_qualifications) {
      const worker = await prisma.user.findUnique({
        where: { id: tokenRecord.worker_id },
        select: {
          name: true,
          qualifications: true,
          qualification_certificates: true,
        },
      });

      if (worker?.qualification_certificates) {
        const certificates = worker.qualification_certificates as Record<string, string>;

        for (const [qualName, certPath] of Object.entries(certificates)) {
          if (certPath && typeof certPath === 'string') {
            try {
              // public/から始まるパスを処理
              const fullPath = path.default.join(process.cwd(), 'public', certPath.replace(/^\//, ''));
              const fileBuffer = await fs.readFile(fullPath);
              const ext = path.default.extname(certPath) || '.png';
              const safeName = qualName.replace(/[/\\?%*:|"<>]/g, '_');
              archive.append(fileBuffer, { name: `資格証明書/${safeName}${ext}` });
            } catch (err) {
              console.error(`Failed to read certificate: ${certPath}`, err);
            }
          }
        }
      }
    }

    // ZIPを完成させる
    await archive.finalize();
    await archivePromise;

    // トークンレコードを更新
    await prisma.laborDocumentDownloadToken.update({
      where: { id: tokenId },
      data: {
        status: 'COMPLETED',
        zip_path: zipRelativePath,
      },
    });

    console.log(`[generateZipAsync] ZIP generated successfully: ${zipPath}`);

    // メール送信（モック）
    console.log(`[generateZipAsync] Email would be sent to: ${tokenRecord.email}`);
    console.log(`[generateZipAsync] Download URL: ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/download/labor-docs/${tokenRecord.token}`);

  } catch (error) {
    console.error('[generateZipAsync] Error:', error);

    // エラー時はトークンレコードを更新
    await prisma.laborDocumentDownloadToken.update({
      where: { id: tokenId },
      data: {
        status: 'FAILED',
        error_message: error instanceof Error ? error.message : '不明なエラー',
      },
    });
  }
}
