import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function CaseCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-2/3 mb-2" />   {/* Case name */}
        <Skeleton className="h-4 w-1/3" />        {/* Badge/status */}
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />  {/* Description */}
        <Skeleton className="h-4 w-4/5 mb-4" />   {/* Description cont. */}

        <div className="flex items-center gap-4 mt-4">
          <Skeleton className="h-4 w-28" />       {/* Created date */}
          <Skeleton className="h-4 w-28" />       {/* Modified date */}
        </div>

        <div className="flex gap-2 mt-4">
          <Skeleton className="h-9 w-24" />       {/* Button 1 */}
          <Skeleton className="h-9 w-24" />       {/* Button 2 */}
        </div>
      </CardContent>
    </Card>
  )
}
