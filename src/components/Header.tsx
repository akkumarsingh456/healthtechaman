import { Menu, X, Search, LogIn, UserPlus, GraduationCap, Stethoscope, LogOut, User, Users, Settings, Shield, ShieldCheck, ShieldAlert, Pill, LayoutDashboard, Package, ClipboardList, Calendar, FileText, ArrowLeft, Home } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import nitwLogo from "@/assets/nitw-logo.png";
import NotificationBell from "@/components/notifications/NotificationBell";

const NAVIGATION_ITEMS = [
  { label: "Home", path: "/", keywords: ["home", "main", "landing"] },
  { label: "Medical Team", path: "/medical-team", keywords: ["doctors", "staff", "medical", "team", "officers"] },
  { label: "Book Appointment", path: "/appointments", keywords: ["book", "appointment", "schedule", "visit"] },
  { label: "My Appointments", path: "/my-appointments", keywords: ["my", "appointments", "scheduled", "upcoming"] },
  { label: "Health Records", path: "/student/profile?tab=records", keywords: ["health", "records", "history", "dashboard", "visits", "prescriptions"] },
  { label: "Sign In", path: "/auth", keywords: ["sign", "login", "auth", "account"] },
  { label: "Admin Portal", path: "/admin", keywords: ["admin", "portal", "management"] },
  { label: "Doctor Portal", path: "/doctor/register", keywords: ["doctor", "portal", "register"] },
  { label: "Student Registration", path: "/student/register", keywords: ["student", "registration", "enroll"] },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, isDoctor, isMentor, isAdmin, isLabOfficer, isPharmacy, isMedicalStaff, loading: roleLoading } = useUserRole();
  const [profilePhoto, setProfilePhoto] = useState<{ userId: string; url: string } | null>(null);
  const avatarUrl = profilePhoto?.userId === user?.id ? profilePhoto?.url : undefined;

  useEffect(() => {
    setProfilePhoto(null);
    if (!user) return;
    let active = true;
    let request = 0;
    const loadPhoto = async () => {
      const current = ++request;
      try {
        const { data: student, error } = await supabase.from('students')
          .select('photo_url').eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        let url = student?.photo_url || '';
        if (url) {
          const match = new URL(url).pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/student-photos\/(.+)$/);
          if (match) {
            const { data, error: photoError } = await supabase.storage.from('student-photos')
              .createSignedUrl(decodeURIComponent(match[1]), 3600);
            if (photoError) throw photoError;
            url = data.signedUrl;
          }
        }
        if (active && current === request) setProfilePhoto(url ? { userId: user.id, url } : null);
      } catch (error) {
        console.error('Could not load header profile photo', error);
      }
    };
    const refresh = () => { void loadPhoto(); };
    refresh();
    window.addEventListener('student-profile-photo-updated', refresh);
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 45 * 60 * 1000);
    return () => {
      active = false;
      window.removeEventListener('student-profile-photo-updated', refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!roleLoading) {
      setIsLoading(false);
    }
  }, [roleLoading]);

  const handleSignOut = async () => {
    try {
      // Clear role cache before signing out
      const { clearRoleCache } = await import('@/hooks/useUserRole');
      clearRoleCache();
      
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      // Even if server returns error (stale session), local sign out is fine
      if (error) {
        console.warn('Sign out server error (session cleared locally):', error.message);
      }
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully.",
      });
      navigate("/");
    } catch (e) {
      // Force local cleanup on any failure
      localStorage.removeItem('sb-chsjhycuuwrlluwlumfb-auth-token');
      toast({
        title: "Signed Out",
        description: "You have been signed out.",
      });
      navigate("/");
    }
  };

  const filteredItems = NAVIGATION_ITEMS.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(query) ||
      item.keywords.some((keyword) => keyword.includes(query))
    );
  });

  const handleSelect = (path: string) => {
    navigate(path);
    setSearchQuery("");
    setShowResults(false);
    setIsSearchOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getUserDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const getUserType = () => {
    if (isDoctor) return 'doctor';
    if (isMentor) return 'mentor';
    if (isAdmin) return 'admin';
    if (isMedicalStaff) return 'medical_staff';
    if (isLabOfficer) return 'lab_officer';
    if (isPharmacy) return 'pharmacy';
    return user?.user_metadata?.user_type || 'student';
  };

  const getDashboardPath = () => {
    if (isAdmin) return '/admin/dashboard';
    if (isDoctor) return '/doctor/dashboard';
    if (isMentor) return '/mentor/dashboard';
    if (isLabOfficer) return '/lab/dashboard';
    if (isPharmacy) return '/pharmacy/dashboard';
    if (isMedicalStaff) return '/staff/home';
    return '/health-dashboard';
  };

  const getHomePath = () => {
    if (isAdmin) return '/admin';
    if (isMentor) return '/mentor/home';
    if (isMedicalStaff) return '/staff/home';
    return '/';
  };

  // Determine if we're on the home page for this role
  const homePath = getHomePath();
  const homePages = ['/', '/mentor/home', '/admin', '/staff/home', '/admin/dashboard'];
  const isOnHomePage = homePages.includes(location.pathname) && location.pathname === homePath;
  const publicOnlyPages = ["/auth", "/email-confirmation"];
  const showBackHome = user && !publicOnlyPages.includes(location.pathname) && !isOnHomePage;

  const handleBack = () => {
    if (isLabOfficer || isPharmacy || isMedicalStaff || isAdmin) {
      navigate(homePath);
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="bg-card/95 backdrop-blur-sm border-b border-border sticky top-0 z-50 shadow-sm">
      {/* Back / Home sub-bar */}
      {showBackHome && (
        <div className="border-b border-border bg-muted/40">
          <div className="container mx-auto px-4 py-1 flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 text-xs text-primary hover:bg-primary/10">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(homePath)} className="h-7 text-xs text-primary hover:bg-primary/10">
              <Home className="h-3.5 w-3.5 mr-1" />
              Home
            </Button>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between min-h-[72px]">
          {/* Logo Section */}
          <Link to={getHomePath()} className="flex items-center gap-3 shrink-0">
            <img 
              src={nitwLogo} 
              alt="NIT Warangal Logo" 
              className="w-12 h-12 md:w-14 md:h-14 object-contain"
            />
            <div className="flex flex-col">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-foreground leading-tight tracking-tight">
                National Institute of Technology
              </h1>
              <p className="text-xs sm:text-sm text-primary font-medium">
                Warangal, Telangana
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {/* Search Bar */}
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Quick search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  className="pl-9 w-48 lg:w-64 h-9 bg-background"
                />
              </div>
              {showResults && searchQuery && (
                <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                  {filteredItems.length > 0 ? (
                    <ul className="py-1">
                      {filteredItems.map((item) => (
                        <li key={item.path}>
                          <button
                            onClick={() => handleSelect(item.path)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                          >
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No results found</p>
                  )}
                </div>
              )}
            </div>

            <nav className="flex items-center gap-4 lg:gap-6">
              {isDoctor ? (
                <>
                  <Link to="/doctor/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Team
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Leave
                  </Link>
                </>
              ) : isLabOfficer ? (
                <>
                  <Link to="/lab/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Lab Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Team
                  </Link>
                </>
              ) : isPharmacy ? (
                <>
                  <Link to="/pharmacy/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Pharmacy Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Team
                  </Link>
                </>
              ) : isMentor ? (
                <>
                  <Link to="/mentor/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Team
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Leave
                  </Link>
                </>
              ) : isMedicalStaff ? (
                <>
                  <Link to="/staff/home" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Home
                  </Link>
                  <Link to="/staff/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Staff Dashboard
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Leave
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Team
                  </Link>
                </>
              ) : isAdmin ? (
                <>
                  <Link to="/admin/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Dashboard
                  </Link>
                  <Link to="/admin/dashboard?tab=submissions" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Submissions
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Team
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Leave
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Medical Team
                  </Link>
                  <Link to="/appointments" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Appointments
                  </Link>
                  <Link to="/student/profile?tab=records" className="text-muted-foreground hover:text-primary transition-colors font-medium text-sm">
                    Health Records
                  </Link>
                </>
              )}
              
              {/* Auth Section */}
              {isLoading ? (
                <div className="w-20 h-9 bg-muted animate-pulse rounded-md" />
              ) : user ? (
                <>
                {isDoctor && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    onClick={() => navigate('/doctor/dashboard')}
                    title="Pending Access Requests"
                  >
                    <Shield className="w-5 h-5 text-muted-foreground" />
                  </Button>
                )}
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <span className="w-7 h-7 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={getUserDisplayName()} className="w-full h-full object-cover" onError={() => setProfilePhoto(null)} />
                        ) : getUserDisplayName().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="max-w-[100px] truncate">{getUserDisplayName()}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{getUserDisplayName()}</p>
                      <p className="text-xs text-primary">
                        {isDoctor ? 'Medical Officer' : isMentor ? 'Faculty Mentor' : isAdmin ? 'Admin' : isLabOfficer ? 'Lab Officer' : isPharmacy ? 'Pharmacy' : isMedicalStaff ? 'Medical Staff' : 'Student'}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    {isDoctor ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/doctor/profile" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/doctor/profile?tab=settings" className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Settings
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : isPharmacy ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/pharmacy/dashboard" className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            Pharmacy Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/pharmacy/dashboard?filter=pending" className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4" />
                            Pending Prescriptions
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/pharmacy/dashboard?tab=inventory" className="flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Inventory
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : isMedicalStaff ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/staff/home" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/staff/dashboard" className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            Staff Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/medical-leave" className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Medical Leave
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/medical-team" className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4" />
                            Medical Team
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : isLabOfficer ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/lab/dashboard" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/lab/dashboard" className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            Lab Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/medical-team" className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4" />
                            Medical Team
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : isMentor ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/mentor/profile" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/mentor/dashboard" className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            My Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/medical-leave" className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Medical Leave
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/mentor/profile?tab=settings" className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Settings
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : isAdmin ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/dashboard" className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/medical-team" className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4" />
                            Medical Team
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/medical-leave" className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Medical Leave
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/dashboard?tab=security" className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" />
                            Security
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/student/profile" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={getDashboardPath()} className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            My Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/my-appointments" className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4" />
                            My Appointments
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/student/profile?tab=settings" className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Settings
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to="/auth">
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="gap-2">
                    <Link to="/auth">
                      <UserPlus className="w-4 h-4" />
                      Sign Up
                    </Link>
                  </Button>
                </>
              )}
            </nav>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              className="p-2"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              <Search className="h-5 w-5" />
            </button>
            <button 
              className="p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        {isSearchOpen && (
          <div className="md:hidden py-3 border-t border-border animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                className="pl-9 bg-background"
                autoFocus
              />
            </div>
            {showResults && searchQuery && (
              <div className="mt-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {filteredItems.length > 0 ? (
                  <ul className="py-1">
                    {filteredItems.map((item) => (
                      <li key={item.path}>
                        <button
                          onClick={() => handleSelect(item.path)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No results found</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              {/* User Info for Mobile */}
              {user && (
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${
                    getUserType() === 'doctor' ? 'bg-secondary/10' : 'bg-primary/10'
                  }`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={getUserDisplayName()} className="w-full h-full object-cover" onError={() => setProfilePhoto(null)} />
                    ) : getUserType() === 'doctor' ? (
                      <Stethoscope className="w-5 h-5 text-secondary" />
                    ) : (
                      <GraduationCap className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{getUserDisplayName()}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}
              
              {isDoctor ? (
                <>
                  <Link to="/doctor/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Team
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Leave
                  </Link>
                </>
              ) : isLabOfficer ? (
                <>
                  <Link to="/lab/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Lab Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Team
                  </Link>
                </>
              ) : isPharmacy ? (
                <>
                  <Link to="/pharmacy/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Pharmacy Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Team
                  </Link>
                </>
              ) : isMentor ? (
                <>
                  <Link to="/mentor/home" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Home
                  </Link>
                  <Link to="/mentor/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Team
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Leave
                  </Link>
                  <Link to="/mentor/profile" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Profile
                  </Link>
                </>
              ) : isMedicalStaff ? (
                <>
                  <Link to="/staff/home" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Home
                  </Link>
                  <Link to="/staff/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Staff Dashboard
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Leave
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Team
                  </Link>
                </>
              ) : isAdmin ? (
                <>
                  <Link to="/admin/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Dashboard
                  </Link>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Team
                  </Link>
                  <Link to="/medical-leave" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Leave
                  </Link>
                  <Link to="/admin/dashboard?tab=security" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Security
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/medical-team" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Medical Team
                  </Link>
                  <Link to="/appointments" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Book Appointment
                  </Link>
                  <Link to="/my-appointments" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    My Appointments
                  </Link>
                  <Link to="/student/profile?tab=records" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
                    Health Records
                  </Link>
                </>
              )}
              <div className="flex flex-col gap-2 pt-2">
                {user ? (
                  <Button variant="destructive" className="w-full gap-2" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="w-full gap-2">
                      <Link to="/auth">
                        <GraduationCap className="w-4 h-4" />
                        New User / Student
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" className="w-full gap-2">
                      <Link to="/auth">
                        <Stethoscope className="w-4 h-4" />
                        Doctor / Medical Staff
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
