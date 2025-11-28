import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateJobs() {
    // 同一条件のJobをグループ化するキーを作成
    const jobs = await prisma.job.findMany({
        include: { workDates: true },
    });

    // facility_id + title + start_time + end_time + hourly_wage でグループ化
    const groups = new Map<string, typeof jobs>();

    for (const job of jobs) {
        const key = `${job.facility_id}-${job.title}-${job.start_time}-${job.end_time}-${job.hourly_wage}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(job);
    }

    // 各グループを1つのJobに統合
    for (const [key, groupJobs] of groups) {
        if (groupJobs.length <= 1) continue; // 統合不要

        const primaryJob = groupJobs[0]; // 最初のJobを残す
        const otherJobs = groupJobs.slice(1);

        // 他のJobのworkDatesをprimaryJobに移動
        for (const job of otherJobs) {
            const workDates = await prisma.jobWorkDate.findMany({ where: { job_id: job.id } });
            let canDeleteJob = true;

            for (const wd of workDates) {
                // primaryJobに同じ日付があるか確認
                const existingWd = await prisma.jobWorkDate.findFirst({
                    where: {
                        job_id: primaryJob.id,
                        work_date: wd.work_date,
                    },
                });

                if (existingWd) {
                    console.log(`Duplicate date ${wd.work_date.toISOString()} for job ${job.id} -> ${primaryJob.id}`);
                    // 重複がある場合
                    if (wd.applied_count === 0) {
                        // 応募がなければ削除
                        await prisma.jobWorkDate.delete({ where: { id: wd.id } });
                    } else {
                        console.warn(`Cannot merge job ${job.id} date ${wd.work_date.toISOString()} because it has applicants.`);
                        canDeleteJob = false;
                    }
                } else {
                    // 重複がなければ移動
                    await prisma.jobWorkDate.update({
                        where: { id: wd.id },
                        data: { job_id: primaryJob.id },
                    });
                }
            }

            // すべてのWorkDateを移動または削除できた場合のみJobを削除
            if (canDeleteJob) {
                await prisma.job.delete({ where: { id: job.id } });
            }
        }

        console.log(`Merged ${groupJobs.length} jobs into job #${primaryJob.id}`);
    }
}

migrateJobs()
    .then(() => console.log('Migration completed'))
    .catch(console.error)
    .finally(() => prisma.$disconnect());
