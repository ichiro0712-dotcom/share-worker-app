import { Skeleton } from "@/components/ui/skeleton";

export default function WorkerLoading() {
    return (
        <div className="w-full min-h-screen bg-white p-4">
            <div className="space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-64 w-full rounded-xl" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                </div>
            </div>
        </div>
    );
}
