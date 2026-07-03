import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LogIn, 
  Key, 
  ShieldAlert, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  UserPlus, 
  ShieldCheck 
} from "lucide-react";
import { auth } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { playSynthesizedSound, triggerHapticFeedback } from "../lib/utils";

interface LoginScreenProps {
  onGoogleLogin: () => Promise<any>;
  onGuestLogin: () => void;
}

export function LoginScreen({ onGoogleLogin, onGuestLogin }: LoginScreenProps) {
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [loadingType, setLoadingType] = useState<"google" | "guest" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Email login state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Retrieve the previously used Google account email if stored
    const savedEmail = localStorage.getItem("ts_last_google_email");
    if (savedEmail) {
      setLastEmail(savedEmail);
    }
  }, []);

  // Simple, elegant real-time password strength evaluation
  const evaluatePasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Empty", color: "bg-slate-700" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score, label: "Weak", color: "bg-rose-500", text: "text-rose-400" };
    if (score <= 4) return { score, label: "Medium", color: "bg-amber-500", text: "text-amber-400" };
    return { score, label: "Strong", color: "bg-emerald-500", text: "text-emerald-400" };
  };

  const strength = evaluatePasswordStrength(password);

  const handleGoogleLoginClick = async () => {
    setLoadingType("google");
    setError(null);
    triggerHapticFeedback("button");
    try {
      await onGoogleLogin();
      playSynthesizedSound("success");
    } catch (err: any) {
      console.error("Google Auth failed:", err);
      setError(err?.message || "Google Authentication failed. Please try again.");
      playSynthesizedSound("error");
      triggerHapticFeedback("error");
      setLoadingType(null);
    }
  };

  const handleGuestLoginClick = () => {
    setLoadingType("guest");
    setError(null);
    triggerHapticFeedback("button");
    playSynthesizedSound("click");
    // Simulate minor visual loading for professional enterprise feedback
    setTimeout(() => {
      onGuestLogin();
      playSynthesizedSound("success");
      setLoadingType(null);
    }, 800);
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoadingType("email");
    setError(null);
    triggerHapticFeedback("button");

    try {
      if (isSignUp) {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long for system compliance.");
        }
        await createUserWithEmailAndPassword(auth, email, password);
        playSynthesizedSound("success");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        playSynthesizedSound("success");
      }
    } catch (err: any) {
      console.error("Email Auth failed:", err);
      let friendlyMessage = err.message;
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        friendlyMessage = "Invalid credentials. Please verify your email ID and security password.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email ID is already registered under a security credential. Try signing in.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "The security password provided is too weak. Please reinforce password criteria.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "The email format is invalid. Please supply a conforming email ID.";
      }
      setError(friendlyMessage);
      playSynthesizedSound("error");
      triggerHapticFeedback("error");
      setLoadingType(null);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-center items-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 animate-login-gradient p-4 sm:p-6 md:p-8 select-none">
      
      {/* 1. Slowly moving / morphing background colorful glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            scale: [1, 1.3, 0.9, 1.1, 1],
            x: [0, 80, -40, 50, 0],
            y: [0, -40, 60, -20, 0],
            opacity: [0.15, 0.3, 0.2, 0.25, 0.15],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-amber-500/25 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            scale: [1.2, 0.9, 1.3, 1, 1.2],
            x: [0, -60, 50, -30, 0],
            y: [0, 60, -40, 50, 0],
            opacity: [0.2, 0.1, 0.3, 0.15, 0.2],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-indigo-500/20 blur-[150px] rounded-full"
        />
        <motion.div
          animate={{
            scale: [0.8, 1.2, 1, 0.9, 0.8],
            x: [0, 30, -50, 20, 0],
            y: [0, 50, -30, -60, 0],
            opacity: [0.1, 0.2, 0.15, 0.25, 0.1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[30%] left-[25%] w-[45%] h-[45%] bg-teal-500/15 blur-[110px] rounded-full"
        />
      </div>

      {/* 2. Top Bar - Show logo of app with name professionally */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/40 border-b border-white/5 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="relative overflow-hidden h-9 w-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-1 border border-white/10 shadow-lg">
              <img src="/logo.png" alt="TS" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter text-white leading-none">
                TS <span className="text-[10px] font-bold opacity-60 ml-1 tracking-[0.2em] uppercase">Price Manager</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-400 font-black">
              SECURE GATEWAY
            </p>
          </div>
        </div>
      </header>

      {/* 3. Central Login Card */}
      <motion.div 
        layout
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-slate-900/40 border border-white/10 backdrop-blur-md rounded-[3rem] p-8 sm:p-10 shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-teal-500" />
        
        {/* Card Header (Logo & Heading) */}
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-indigo-600 blur-2xl opacity-40 group-hover:opacity-60 transition-opacity rounded-3xl" />
            <div className="relative h-20 w-20 rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/10 flex items-center justify-center p-2.5 shadow-2xl transform group-hover:scale-105 transition-transform duration-500">
              <img src="/logo.png" alt="TS Price Logo" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-amber-400">
              <Sparkles size={14} className="animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em]">ENTRANCE SYSTEM</span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white">
              Database Entrance
            </h2>
            <p className="text-xs text-slate-400/80 max-w-sm font-medium leading-relaxed">
              {showEmailForm 
                ? "Supply credentials to authorize and access enterprise storage." 
                : "Select your authorization vector to access system pricing sheets, cloud inventory controls, and metrics."}
            </p>
          </div>
        </div>

        {/* Error Alert if Authentication Fails */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-left"
          >
            <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 font-semibold leading-relaxed">
              {error}
            </p>
          </motion.div>
        )}

        {/* Dynamic Content Switching between Google/Guest and Email/Password */}
        <AnimatePresence mode="wait">
          {!showEmailForm ? (
            <motion.div
              key="social-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="mt-8 space-y-4"
            >
              {/* Google Login Button */}
              <button
                onClick={handleGoogleLoginClick}
                disabled={loadingType !== null}
                className="w-full group relative flex flex-col items-center justify-center gap-1 px-6 py-4 bg-gradient-to-b from-white to-slate-100 hover:from-white hover:to-white text-slate-900 rounded-2xl font-black uppercase tracking-wider text-xs transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center justify-center gap-3">
                  {loadingType === "google" ? (
                    <Loader2 size={16} className="animate-spin text-slate-600" />
                  ) : (
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.5-1.14 2.78-2.4 3.63v3.02h3.88c2.27-2.09 3.65-5.17 3.65-8.8h.005z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.11C3.18 21.88 7.39 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.62H1.21C.4 8.24 0 10.07 0 12s.4 3.76 1.21 5.38l4.11-3.11z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.39 0 3.18 2.12 1.21 5.38l4.11 3.11c.94-2.85 3.57-4.96 6.68-4.96z"
                      />
                    </svg>
                  )}
                  
                  <span>
                    {lastEmail ? "Continue as Google User" : "Sign In with Google"}
                  </span>
                </div>

                {lastEmail && (
                  <span className="text-[10px] font-bold text-indigo-600 lowercase tracking-normal">
                    {lastEmail}
                  </span>
                )}
              </button>

              {/* Direct Email/Password toggle button */}
              <button
                onClick={() => {
                  triggerHapticFeedback("button");
                  playSynthesizedSound("click");
                  setShowEmailForm(true);
                  setError(null);
                }}
                disabled={loadingType !== null}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-800/40 hover:bg-slate-800/60 border border-white/5 text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all duration-300 disabled:opacity-50 cursor-pointer"
              >
                <Mail size={16} className="text-indigo-400" />
                <span>Sign In with Email & Password</span>
              </button>

              {/* Divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink mx-4 text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">OR</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              {/* Guest Login Button */}
              <button
                onClick={handleGuestLoginClick}
                disabled={loadingType !== null}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-800/20 hover:bg-slate-800/30 border border-white/5 text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
              >
                {loadingType === "guest" ? (
                  <Loader2 size={16} className="animate-spin text-white/60" />
                ) : (
                  <Key size={16} className="text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
                )}
                <span>Enter as Guest</span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="email-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mt-8 space-y-5"
            >
              {/* Back to main vectors */}
              <button
                onClick={() => {
                  triggerHapticFeedback("button");
                  playSynthesizedSound("click");
                  setShowEmailForm(false);
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} /> Back to Authorization Options
              </button>

              <form onSubmit={handleEmailAuthSubmit} className="space-y-4 text-left">
                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Mail size={12} className="text-indigo-400" />
                    Secure Email ID
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@domain.com"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 p-3.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-1.5 relative">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Lock size={12} className="text-indigo-400" />
                    Security Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 p-3.5 pr-11 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Meter (Only for signup) */}
                {isSignUp && password && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-1 pb-1"
                  >
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide">
                      <span className="text-slate-500">Security Robustness:</span>
                      <span className={strength.text}>{strength.label}</span>
                    </div>
                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full ${strength.color}`} 
                        initial={{ width: 0 }}
                        animate={{ width: `${(strength.score / 5) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-500 leading-normal">
                      Recommendation: Mix uppercase, symbols, numbers & at least 8 characters.
                    </p>
                  </motion.div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loadingType !== null}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loadingType === "email" ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : isSignUp ? (
                    <UserPlus size={16} />
                  ) : (
                    <LogIn size={16} />
                  )}
                  <span>{isSignUp ? "Register Secure Account" : "Access Database"}</span>
                </button>
              </form>

              {/* Toggle Sign-In vs Sign-Up */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback("button");
                    playSynthesizedSound("click");
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-[10px] font-bold text-slate-400 hover:text-white underline tracking-wide transition-colors cursor-pointer"
                >
                  {isSignUp 
                    ? "Already have an account? Sign In" 
                    : "Need a dedicated email account? Register New"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature Highlights/Invariants info */}
        <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-4 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <ShieldCheck size={12} />
              <span className="text-[9px] font-bold uppercase tracking-wider">MFA & SYNC READY</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal font-medium">
              Enterprise accounts can bind multiple secure credentials under a single schema.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400">
              <CheckCircle2 size={12} />
              <span className="text-[9px] font-bold uppercase tracking-wider">OFFLINE HUB</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal font-medium">
              Changes auto-save locally and reconcile upon cloud reconnect.
            </p>
          </div>
        </div>

      </motion.div>

      {/* Footer System Branding */}
      <footer className="absolute bottom-6 left-0 right-0 z-10 text-center pointer-events-none">
        <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-white/20">
          TS Price Manager • Powered by Firebase Enterprise
        </p>
      </footer>

    </div>
  );
}
