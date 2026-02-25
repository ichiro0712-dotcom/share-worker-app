import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    await prisma.registrationPageView.create({
      data: { session_id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Registration tracking error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
