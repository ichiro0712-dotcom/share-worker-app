import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false });
    }

    const userId = parseInt(session.user.id as string, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ success: false });
    }

    const body = await request.json();
    const { jobId } = body;

    if (typeof jobId !== 'number' || jobId < 1) {
      return NextResponse.json({ success: false });
    }

    await prisma.jobDetailPageView.create({
      data: {
        user_id: userId,
        job_id: jobId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job detail tracking error:', error);
    return NextResponse.json({ success: false });
  }
}
