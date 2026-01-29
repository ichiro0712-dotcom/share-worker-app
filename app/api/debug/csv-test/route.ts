import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Step 1: Basic response test
    const step1 = 'Basic response OK';

    // Step 2: Try to import prisma
    let step2 = 'Prisma not tested';
    try {
      const { prisma } = await import('@/lib/prisma');
      const count = await prisma.attendance.count();
      step2 = `Prisma OK - Attendance count: ${count}`;
    } catch (e) {
      step2 = `Prisma Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Step 3: Try to import CSV generator
    let step3 = 'CSV generator not tested';
    try {
      const { generateAttendanceInfoCsv } = await import('@/src/lib/csv-export/attendance-info-csv');
      step3 = `CSV generator OK - Function exists: ${typeof generateAttendanceInfoCsv === 'function'}`;
    } catch (e) {
      step3 = `CSV generator Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Step 4: Try to generate CSV with minimal data
    let step4 = 'CSV generation not tested';
    try {
      const { generateAttendanceInfoCsv } = await import('@/src/lib/csv-export/attendance-info-csv');
      const testData = [{
        id: 1,
        user_id: 1,
        check_in_time: new Date(),
        check_out_time: new Date(),
        actual_start_time: null,
        actual_end_time: null,
        actual_break_time: null,
        status: 'CHECKED_OUT',
        user: { id: 1, name: 'Test User' },
        job: null,
        facility: { id: 1, facility_name: 'Test Facility' },
      }];
      const csv = generateAttendanceInfoCsv(testData);
      step4 = `CSV generation OK - Length: ${csv.length}`;
    } catch (e) {
      step4 = `CSV generation Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json({
      success: true,
      steps: { step1, step2, step3, step4 },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
