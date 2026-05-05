import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Stethoscope, ArrowRight, CheckCircle2, XCircle, Calendar, ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  related_appointment_id: string | null;
}

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'approved':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20';
      case 'rejected':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'rescheduled':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'medical_leave_referral':
        return 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/20';
      case 'medical_leave_on_leave':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      case 'medical_leave_returned':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20';
      case 'mentee_leave_on_leave':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20';
      case 'mentee_leave_returned':
        return 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/20';
      case 'referral_on_leave':
        return 'border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/20';
      case 'referral_returned':
        return 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20';
      case 'prescription':
        return 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/20';
      case 'certificate_issued':
        return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20';
      case 'lab_report':
        return 'border-l-cyan-500 bg-cyan-50 dark:bg-cyan-950/20';
      case 'contact_submission':
        return 'border-l-sky-500 bg-sky-50 dark:bg-sky-950/20';
      default:
        return 'border-l-primary bg-primary/5';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approved': return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />;
      case 'rejected': return <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />;
      case 'rescheduled': return <Calendar className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />;
      case 'prescription':
        return <Stethoscope className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />;
      case 'certificate_issued':
        return <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />;
      case 'lab_report':
        return <Bell className="h-3.5 w-3.5 text-cyan-600 flex-shrink-0" />;
      case 'contact_submission':
        return <MessageSquare className="h-3.5 w-3.5 text-sky-600 flex-shrink-0" />;
      case 'medical_leave_referral':
      case 'medical_leave_on_leave':
      case 'medical_leave_returned':
      case 'mentee_leave_on_leave':
      case 'mentee_leave_returned':
      case 'referral_on_leave':
      case 'referral_returned':
        return <Stethoscope className="h-3.5 w-3.5 text-primary flex-shrink-0" />;
      default:
        return <Bell className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
    }
  };

  const getActionLabel = (type: string) => {
    if (type === 'prescription') return 'View Prescription';
    if (type === 'certificate_issued') return 'View Certificate';
    if (type === 'lab_report') return 'View Lab Reports';
    if (type === 'contact_submission') return 'Open Submission';
    if (type.startsWith('medical_leave_') || type.startsWith('mentee_leave_') || type.startsWith('referral_')) {
      return 'Open Medical Leave';
    }
    if (type === 'approved' || type === 'rejected') return 'View My Appointments';
    return null;
  };

  if (!userId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-500"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-primary"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
          <div className="divide-y">
              {notifications.map((notification) => {
                const isMedicalLeave = notification.type.startsWith('medical_leave_') || 
                  notification.type.startsWith('mentee_leave_') || 
                  notification.type.startsWith('referral_');
                const actionLabel = getActionLabel(notification.type);
                
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 border-l-4 cursor-pointer transition-colors hover:bg-muted/50",
                      getTypeStyles(notification.type),
                      !notification.read && "font-medium"
                    )}
                    onClick={() => {
                      if (!notification.read) {
                        markAsReadMutation.mutate(notification.id);
                      }
                      setOpen(false);
                      if (notification.type === 'prescription') {
                        navigate("/student/profile?tab=prescriptions");
                      } else if (notification.type === 'certificate_issued') {
                        navigate("/student/profile?tab=certificates");
                      } else if (notification.type === 'lab_report') {
                        navigate("/student/profile?tab=labtests");
                      } else if (notification.type === 'contact_submission') {
                        navigate("/admin/dashboard?tab=submissions");
                      } else if (isMedicalLeave) {
                        navigate("/medical-leave");
                      } else if (notification.type === 'approved' || notification.type === 'rejected') {
                        navigate("/my-appointments");
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {getNotificationIcon(notification.type)}
                          <p className="text-sm font-medium truncate">{notification.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        {actionLabel && (
                          <p className="text-xs text-primary mt-1.5 flex items-center gap-1 font-medium">
                            <ArrowRight className="h-3 w-3" />
                            {actionLabel}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
