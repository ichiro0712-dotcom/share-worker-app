'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getJobTemplate } from '@/src/lib/actions';
import JobTemplateForm, { TemplateInitialData } from '@/components/admin/JobTemplateForm';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditJobTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<TemplateInitialData | null>(null);

  const templateId = Number(params.id);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!admin?.facilityId || !templateId) return;

      try {
        const template = await getJobTemplate(templateId, admin.facilityId);

        if (!template) {
          toast.error('テンプレートが見つかりませんでした');
          router.push('/admin/jobs/templates');
          return;
        }

        setInitialData({
          name: template.name,
          title: template.title,
          jobType: template.jobType,
          startTime: template.startTime,
          endTime: template.endTime,
          breakTime: template.breakTime,
          hourlyWage: template.hourlyWage,
          transportationFee: template.transportationFee,
          recruitmentCount: template.recruitmentCount,
          qualifications: template.qualifications,
          jobDescription: template.description || '',
          skills: template.skills,
          dresscode: template.dresscode,
          belongings: template.belongings,
          existingImages: template.images || [],
          existingDresscodeImages: template.dresscodeImages || [],
          existingAttachments: template.attachments || [],
          notes: template.notes || '',
          icons: template.icons || [],
          workContent: template.workContent || [],
          // Fields not present in JobTemplate schema but required by TemplateInitialData
          recruitmentStartDay: 0,
          recruitmentStartTime: '',
          recruitmentEndDay: 0,
          recruitmentEndTime: '',
          genderRequirement: '',
          dismissalReasons: '',
        });
      } catch (error) {
        console.error('Error fetching template:', error);
        toast.error('テンプレートの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [admin, templateId, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!initialData) {
    return null;
  }

  return (
    <JobTemplateForm
      mode="edit"
      templateId={templateId}
      initialData={initialData}
    />
  );
}
