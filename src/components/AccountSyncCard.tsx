import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Lock, 
  Check, 
  X, 
  Loader2, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  UserCheck, 
  Fingerprint, 
  KeyRound, 
  AlertTriangle 
} from "lucide-react";
import { auth } from "../firebase";
import { 
  EmailAuthProvider, 
  linkWithCredential, 
  updatePassword, 
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { playSynthesizedSound, triggerHapticFeedback } from "../lib/utils";

interface AccountSyncCardProps {
  onTriggerToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AccountSyncCard({ onTriggerToast }: AccountSyncCardProps) {
  const [providers, setProviders] = useState(() => auth.currentUser?.providerData || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Card view toggles
  const [isLinking, setIsLinking] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Form states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Reauth states
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<"link" | "change" | null>(null);

  useEffect(() => {
    // Keep providers list in sync
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setProviders([...user.providerData]);
      } else {
        setProviders([]);
      }
    });
    return () => unsub();
  }, []);

  const hasGoogle = providers.some(p => p.providerId === "google.com");
  const hasPassword = providers.some(p => p.providerId === "password");

  // Refresh user providers list from server
  const handleRefreshProviders = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    triggerHapticFeedback("button");
    try {
      await auth.currentUser.reload();
      setProviders([...(auth.currentUser.providerData || [])]);
      playSynthesizedSound("success");
      onTriggerToast("Security credentials refreshed successfully.", "success");
    } catch (err: any) {
      console.error(err);
      onTriggerToast("Failed to refresh security state.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Evaluate password strength
  const evaluatePassword = (pass: string) => {
    const checks = {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      symbol: /[^A-Za-z0-9]/.test(pass),
    };

    const count = Object.values(checks).filter(Boolean).length;
    let label = "Vulnerable";
    let color = "bg-rose-500";
    let text = "text-rose-400";

    if (count >= 4) {
      label = "Maximum Protection";
      color = "bg-emerald-500";
      text = "text-emerald-400";
    } else if (count >= 3) {
      label = "Standard Vault";
      color = "bg-amber-500";
      text = "text-amber-400";
    }

    return { score: count, label, color, text, checks };
  };

  const strength = evaluatePassword(password);

  // Core password validation before linking/changing
  const isPasswordValid = strength.score >= 3 && password === confirmPassword;

  // Handle reauthentication
  const handleReauthenticate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);
    triggerHapticFeedback("button");

    try {
      if (hasGoogle && pendingAction === "link") {
        // Reauth with Google
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(auth.currentUser, provider);
      } else if (hasPassword) {
        // Reauth with current email/password
        if (!reauthPassword) {
          throw new Error("Current password is required to verify identity.");
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, reauthPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        // If they only have Google but are changing password (which requires password reauth)
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(auth.currentUser, provider);
      }

      setShowReauthModal(false);
      setReauthPassword("");
      onTriggerToast("Identity verified. Continuing operation.", "success");
      playSynthesizedSound("success");

      // Resume pending operation
      if (pendingAction === "link") {
        await executeLinkPassword();
      } else if (pendingAction === "change") {
        await executeChangePassword();
      }
    } catch (err: any) {
      console.error("Reauthentication failed:", err);
      let friendlyError = "Failed to verify identity. Please check your credentials.";
      if (err.code === "auth/wrong-password") {
        friendlyError = "The security password provided is incorrect.";
      }
      setError(friendlyError);
      playSynthesizedSound("error");
      triggerHapticFeedback("error");
    } finally {
      setLoading(false);
    }
  };

  // 1. Link Password credential
  const executeLinkPassword = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    setLoading(true);
    setError(null);

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await linkWithCredential(user, credential);
      
      // Update local state
      await user.reload();
      setProviders([...user.providerData]);

      // Success
      setSuccess("Your account is now fully secured with an Email/Password credential.");
      playSynthesizedSound("link");
      triggerHapticFeedback("success");
      onTriggerToast("Credential linked successfully!", "success");

      // Reset form
      setPassword("");
      setConfirmPassword("");
      setIsLinking(false);
      setPendingAction(null);
    } catch (err: any) {
      console.error("Linking error:", err);
      if (err.code === "auth/requires-recent-login") {
        // Trigger re-authentication modal
        setPendingAction("link");
        setShowReauthModal(true);
        setError("To protect your database credentials, re-authenticate before modifying accounts.");
      } else {
        setError(err.message || "Credential linkage rejected.");
        playSynthesizedSound("error");
        triggerHapticFeedback("error");
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Change Password
  const executeChangePassword = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await updatePassword(user, password);
      
      setSuccess("Your security password has been changed securely.");
      playSynthesizedSound("success");
      triggerHapticFeedback("success");
      onTriggerToast("Security password updated successfully!", "success");

      // Reset form
      setPassword("");
      setConfirmPassword("");
      setIsChanging(false);
      setPendingAction(null);
    } catch (err: any) {
      console.error("Password change error:", err);
      if (err.code === "auth/requires-recent-login") {
        setPendingAction("change");
        setShowReauthModal(true);
        setError("Session expired. Please re-verify your identity to update security vault.");
      } else {
        setError(err.message || "Failed to update security password.");
        playSynthesizedSound("error");
        triggerHapticFeedback("error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      triggerHapticFeedback("error");
      return;
    }

    if (isLinking) {
      await executeLinkPassword();
    } else if (isChanging) {
      await executeChangePassword();
    }
  };

  return (
    <div className="card p-8 bg-[var(--card)] border border-[var(--border)] rounded-[2.5rem] shadow-xl relative overflow-hidden text-left">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-primary to-teal-500" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-sm">
            <Fingerprint size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Account Credentials Sync</h3>
            <p className="text-[10px] font-bold text-[var(--foreground)]/40 uppercase tracking-wider font-mono">Pragmatic Credential Architecture</p>
          </div>
        </div>

        <button
          onClick={handleRefreshProviders}
          disabled={loading}
          className="p-2 bg-[var(--background)] border border-[var(--border)] rounded-xl hover:border-indigo-500/40 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-all cursor-pointer disabled:opacity-55"
          title="Refresh Credential State"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Active vectors display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Google status */}
        <div className="p-4 bg-[var(--background)]/40 border border-[var(--border)] rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <svg className="h-4 w-4 fill-red-400" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.355 0-6.075-2.72-6.075-6.075s2.72-6.075 6.075-6.075c1.474 0 2.825.534 3.882 1.412l3.141-3.141C18.99 1.764 15.86 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.82 0 12.24-5.42 12.24-12.24 0-.813-.081-1.611-.24-2.395H12.24z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--foreground)]/80">Google Auth</p>
              <p className="text-[9px] font-bold text-[var(--foreground)]/40 font-mono truncate max-w-[130px]">
                {hasGoogle ? auth.currentUser?.email : "Disconnected"}
              </p>
            </div>
          </div>
          <div>
            {hasGoogle ? (
              <span className="flex items-center gap-1 bg-green-500/10 border border-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
                <Check size={10} /> Active
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-slate-500/10 border border-slate-500/20 text-[var(--foreground)]/40 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Email/Password status */}
        <div className="p-4 bg-[var(--background)]/40 border border-[var(--border)] rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
              <Lock size={14} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--foreground)]/80">Vault Password</p>
              <p className="text-[9px] font-bold text-[var(--foreground)]/40 font-mono">
                {hasPassword ? "Direct Login Ready" : "Unbound Account"}
              </p>
            </div>
          </div>
          <div>
            {hasPassword ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
                <Check size={10} /> BOUND
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full animate-pulse">
                UNBOUND
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Actions */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-start gap-3"
          >
            <ShieldCheck size={18} className="text-green-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs text-green-300 font-bold uppercase tracking-wide">Security Update Successful</p>
              <p className="text-[11px] text-green-400/80 font-medium">{success}</p>
            </div>
            <button 
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
          >
            <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs text-red-300 font-bold uppercase tracking-wide">Operation Restricted</p>
              <p className="text-[11px] text-red-400/80 font-medium">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* Buttons to reveal forms */}
        {!isLinking && !isChanging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            {!hasPassword ? (
              <button
                onClick={() => {
                  triggerHapticFeedback("button");
                  playSynthesizedSound("click");
                  setIsLinking(true);
                  setError(null);
                  setSuccess(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                <KeyRound size={14} /> Bind Password Login
              </button>
            ) : (
              <button
                onClick={() => {
                  triggerHapticFeedback("button");
                  playSynthesizedSound("click");
                  setIsChanging(true);
                  setError(null);
                  setSuccess(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all border border-white/5 active:scale-95 cursor-pointer"
              >
                <Lock size={14} /> Change Vault Password
              </button>
            )}
          </motion.div>
        )}

        {/* Linking / Password Modification Form */}
        {(isLinking || isChanging) && (
          <motion.form
            onSubmit={handleFormSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-4 border-t border-[var(--border)]/30"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Lock size={12} />
                {isLinking ? "Define Security Password" : "Define New Security Password"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback("button");
                  playSynthesizedSound("click");
                  setIsLinking(false);
                  setIsChanging(false);
                  setPassword("");
                  setConfirmPassword("");
                  setError(null);
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer underline uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>

            {/* Input fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 relative">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Security Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 pr-11 text-xs text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:border-indigo-500 focus:outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat security password"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:border-indigo-500 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password strength and checklists */}
            {password && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-[var(--background)]/30 border border-[var(--border)] rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wide">
                  <span className="text-slate-400">Entropy Evaluation:</span>
                  <span className={strength.text}>{strength.label}</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className={`h-full ${strength.color}`} 
                    initial={{ width: 0 }}
                    animate={{ width: `${(strength.score / 5) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Micro requirement check list */}
                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="flex items-center gap-1.5">
                    {strength.checks.length ? <Check size={10} className="text-green-400" /> : <X size={10} className="text-red-400" />}
                    <span>8+ Characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {strength.checks.uppercase ? <Check size={10} className="text-green-400" /> : <X size={10} className="text-red-400" />}
                    <span>Capital Letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {strength.checks.lowercase ? <Check size={10} className="text-green-400" /> : <X size={10} className="text-red-400" />}
                    <span>Lowercase Letter</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {strength.checks.number ? <Check size={10} className="text-green-400" /> : <X size={10} className="text-red-400" />}
                    <span>Numeral</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    {strength.checks.symbol ? <Check size={10} className="text-green-400" /> : <X size={10} className="text-red-400" />}
                    <span>Special Character (@#$!%...)</span>
                  </div>
                </div>

                {/* Match confirmation */}
                {confirmPassword && (
                  <div className="pt-2 border-t border-[var(--border)]/20 text-[9px] font-black uppercase tracking-wider">
                    {password === confirmPassword ? (
                      <span className="text-emerald-400 flex items-center gap-1"><Check size={12} /> Security Passwords match perfectly</span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1"><X size={12} /> Security Passwords do not match</span>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={loading || !isPasswordValid}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Verifying...
                  </>
                ) : (
                  <>Secure Vault</>
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 4. Beautiful Re-authentication Modal (Graceful Error Recovery popup) */}
      <AnimatePresence>
        {showReauthModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center text-white"
            >
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider">Identity Verification</h3>
                <p className="text-[10px] text-slate-400 leading-normal font-mono">
                  Firebase rules mandate re-authentication for critical credential modifications.
                </p>
              </div>

              {hasGoogle && pendingAction === "link" ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Verify ownership of the Google Account <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-[11px]">{auth.currentUser?.email}</span>.
                  </p>
                  <button
                    onClick={() => handleReauthenticate()}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : "Authorize with Google"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReauthenticate} className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Security Password</label>
                    <div className="relative">
                      <input
                        type={showReauthPassword ? "text" : "password"}
                        value={reauthPassword}
                        onChange={(e) => setReauthPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-white/10 bg-slate-950 p-3.5 pr-11 text-xs text-white placeholder-slate-700 focus:border-indigo-500 focus:outline-none transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowReauthPassword(!showReauthPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {showReauthPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !reauthPassword}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest py-3.5 px-4 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : "Verify and Proceed"}
                  </button>
                </form>
              )}

              <button
                onClick={() => {
                  setShowReauthModal(false);
                  setPendingAction(null);
                  setLoading(false);
                  setReauthPassword("");
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer underline uppercase tracking-wider"
              >
                Abort Action
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
