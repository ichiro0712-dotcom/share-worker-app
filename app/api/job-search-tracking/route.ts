import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = Number(session.user.id);

    await prisma.jobSearchPageView.create({
      data: { user_id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job search tracking error:', error);
    return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
  }
}
