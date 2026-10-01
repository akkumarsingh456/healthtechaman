import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileField {
  name: string;
  label: string;
  filled: boolean;
  required?: boolean;
}

interface ProfileCompletionIndicatorProps {
  fields: ProfileField[];
  showMissingFields?: boolean;
  className?: string;
}

export default function ProfileCompletionIndicator({ 
  fields, 
  showMissingFields = true,
  className 
}: ProfileCompletionIndicatorProps) {
  const filledCount = fields.filter(f => f.filled).length;
  const totalCount = fields.length;
  const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
  
  const missingRequired = fields.filter(f => f.required && !f.filled);
  const missingOptional = fields.filter(f => !f.required && !f.filled);
  
  const getStatusColor = () => {
    if (percentage === 100) return "text-green-600 dark:text-green-400";
    if (percentage >= 75) return "text-blue-600 dark:text-blue-400";
    if (percentage >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProgressColor = () => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  const getStatusText = () => {
    if (percentage === 100) return "Complete";
    if (percentage >= 75) return "Almost there";
    if (percentage >= 50) return "Halfway done";
    return "Needs attention";
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {percentage === 100 ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className={cn("w-4 h-4", getStatusColor())} />
          )}
          <span className="text-sm font-medium text-foreground">
            Profile Completion
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold", getStatusColor())}>
            {percentage}%
          </span>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs",
              percentage === 100 
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100" 
                : percentage >= 75 
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                  : percentage >= 50
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100"
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100"
            )}
          >
            {getStatusText()}
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <Progress value={percentage} className="h-2" />
        <div 
          className={cn(
            "absolute top-0 left-0 h-full rounded-full transition-all",
            getProgressColor()
          )} 
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Missing Fields */}
      {showMissingFields && (missingRequired.length > 0 || missingOptional.length > 0) && (
        <div className="space-y-2 pt-2">
          {missingRequired.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Required fields missing:
              </p>
              <div className="flex flex-wrap gap-1">
                {missingRequired.map((field) => (
                  <Badge 
                    key={field.name} 
                    variant="outline" 
                    className="text-xs border-red-200 text-red-600 dark:border-red-800 dark:text-red-400"
                  >
                    <Circle className="w-2 h-2 mr-1 fill-current" />
                    {field.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {missingOptional.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Optional fields:
              </p>
              <div className="flex flex-wrap gap-1">
                {missingOptional.slice(0, 3).map((field) => (
                  <Badge 
                    key={field.name} 
                    variant="outline" 
                    className="text-xs text-muted-foreground"
                  >
                    <Circle className="w-2 h-2 mr-1" />
                    {field.label}
                  </Badge>
                ))}
                {missingOptional.length > 3 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{missingOptional.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}