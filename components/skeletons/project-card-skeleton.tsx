import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export function ProjectCardSkeleton() {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <Skeleton className="h-8 w-3/4 mb-2" />  {/* Title */}
        <Skeleton className="h-4 w-1/2" />       {/* Subtitle */}
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />  {/* Description line 1 */}
        <Skeleton className="h-4 w-5/6 mb-2" />   {/* Description line 2 */}
        <Skeleton className="h-4 w-2/3 mb-4" />   {/* Description line 3 */}

        <div className="flex gap-4 mt-4">
          <Skeleton className="h-4 w-24" />       {/* Meta info 1 */}
          <Skeleton className="h-4 w-24" />       {/* Meta info 2 */}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Skeleton className="h-10 w-32" />        {/* Button */}
        <Skeleton className="h-8 w-8 rounded-full" />  {/* Icon button */}
      </CardFooter>
    </Card>
  )
}
