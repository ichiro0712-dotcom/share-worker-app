import { Skeleton } from "@/components/ui/skeleton";

export default function SystemAdminLoading() {
    return (
        <div className="w-full min-h-screen p-8 bg-gray-100">
            <div className="space-y-6 max-w-[1600px] mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <Skeleton className="h-10 w-64" />
                    <div className="flex gap-4">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                    <Skeleton className="h-40 w-full rounded-xl bg-white/50" />
                    <Skeleton className="h-40 w-full rounded-xl bg-white/50" />
                    <Skeleton className="h-40 w-full rounded-xl bg-white/50" />
                    <Skeleton className="h-40 w-full rounded-xl bg-white/50" />
                </div>
                <Skeleton className="h-[600px] w-full rounded-xl bg-white/50" />
            </div>
        </div>
    );
}
