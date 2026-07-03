import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bell, 
  BellOff, 
  BellRing, 
  Check, 
  Copy, 
  X, 
  Loader2, 
  ShieldAlert, 
  ShieldCheck, 
  Send, 
  AlertTriangle,
  RefreshCw,
  Trash2,
  Info,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Activity
} from "lucide-react";
import { auth, db, getFCMToken, onMessageReceived } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { playSynthesizedSound, triggerHapticFeedback } from "../lib/utils";

interface WebPushNotificationCardProps {
  onTriggerToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function WebPushNotificationCard({ onTriggerToast }: WebPushNotificationCardProps) {
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testPayload, setTestPayload] = useState<any>(null);
  const [isIframe, setIsIframe] = useState(false);
  
  // Mobile diagnostics and setup guide states
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showMobileGuides, setShowMobileGuides] = useState(false);
  const [activeServiceWorkers, setActiveServiceWorkers] = useState<{ scriptURL: string; state: string }[]>([]);

  const VAPID_KEY = "BMZytTkcXxgomNS9TrB0-cgqGbWG__1AeDGUUjSJy5V5OCMO79WYXnmCFaPio4YZxZGVGoI27e3WrFKQSxGbrJ0";

  // Refresh list of currently active or registering Service Workers
  const refreshServiceWorkerList = async () => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const list = regs.map(r => {
          const sw = r.active || r.installing || r.waiting;
          return {
            scriptURL: sw ? sw.scriptURL : "Unknown URL",
            state: r.active ? "active" : r.installing ? "installing" : r.waiting ? "waiting" : "inactive"
          };
        });
        setActiveServiceWorkers(list);
      } catch (err) {
        console.error("Error fetching service workers:", err);
      }
    }
  };

  // Check current notification permission status and loaded token on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsIframe(window.self !== window.top);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      
      // Load saved token from localStorage if exists
      const savedToken = localStorage.getItem("fcm_push_token");
      if (savedToken) {
        setToken(savedToken);
      }
    } else {
      setPermission("denied");
      setError("Web Push Notifications are not supported by this browser.");
    }

    // Refresh service worker list on mount
    refreshServiceWorkerList();

    // Set up foreground notification listener
    let unsubscribe: (() => void) | null = null;
    onMessageReceived((payload) => {
      console.log("Foreground notification received:", payload);
      setTestPayload(payload);
      playSynthesizedSound("success");
      triggerHapticFeedback("popup");
      onTriggerToast(
        `Push Alert: ${payload.notification?.title || "New Message"} - ${payload.notification?.body || ""}`, 
        "info"
      );
    }).then((unsub) => {
      if (unsub) unsubscribe = unsub;
    }).catch(err => {
      console.error("Failed to register foreground message listener:", err);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Sync token to Firestore for logged in user
  const syncTokenToFirestore = async (fcmToken: string) => {
    const user = auth.currentUser;
    if (!user || user.uid === 'guest') return;

    try {
      await setDoc(doc(db, 'users', user.uid), {
        fcmToken: fcmToken,
        fcmTokenUpdatedAt: new Date().toISOString()
      }, { merge: true });
      console.log("FCM registration token synced with Firestore profile.");
    } catch (err) {
      console.error("Failed to sync FCM token to Firestore:", err);
    }
  };

  // Unregister all Service Workers to clear stale cache
  const handleUnregisterAll = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    triggerHapticFeedback("button");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        let count = 0;
        for (const reg of regs) {
          await reg.unregister();
          count++;
        }
        localStorage.removeItem("fcm_push_token");
        setToken(null);
        await refreshServiceWorkerList();
        setSuccess(`Successfully unregistered ${count} Service Worker(s) and cleared cached tokens. Click "Request & Enable Push Notifications" above to start fresh!`);
        playSynthesizedSound("success");
        triggerHapticFeedback("success");
        onTriggerToast(`Cleared ${count} Service Worker(s)`, "success");
      } else {
        throw new Error("Service workers are not supported by this browser.");
      }
    } catch (err: any) {
      console.error("Failed to clear service workers:", err);
      setError(`Failed to clear service workers: ${err.message}`);
      playSynthesizedSound("error");
      triggerHapticFeedback("error");
      onTriggerToast("Failed to clear Service Workers", "error");
    } finally {
      setLoading(false);
    }
  };

  // Compile and Copy Diagnostics Report for copy-pasting
  const handleCopyDiagnosticsReport = () => {
    triggerHapticFeedback("button");
    try {
      const report = {
        userAgent: navigator.userAgent,
        notificationsSupported: "Notification" in window,
        notificationPermission: typeof window !== "undefined" ? Notification.permission : "unknown",
        serviceWorkersSupported: "serviceWorker" in navigator,
        registeredServiceWorkers: activeServiceWorkers,
        tokenExistsInLocalStorage: !!localStorage.getItem("fcm_push_token"),
        activeToken: token ? `${token.substring(0, 15)}...${token.substring(token.length - 15)}` : "None",
        isIframeDetected: isIframe,
        appOrigin: window.location.origin
      };
      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      playSynthesizedSound("click");
      onTriggerToast("Diagnostics report copied to clipboard!", "success");
    } catch (err) {
      console.error("Failed to copy report:", err);
      onTriggerToast("Failed to copy diagnostics report", "error");
    }
  };

  const handleEnablePush = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    triggerHapticFeedback("button");

    try {
      if (!("Notification" in window)) {
        throw new Error("Web Push Notifications are not supported by this browser.");
      }

      // Explicitly request notification permission
      const reqPermission = await Notification.requestPermission();
      setPermission(reqPermission);

      if (reqPermission !== "granted") {
        throw new Error("Push Notification permission was denied. Please adjust your browser settings.");
      }

      // Retrieve FCM Token using the provided VAPID Key pair
      const fcmToken = await getFCMToken(VAPID_KEY);
      if (fcmToken) {
        setToken(fcmToken);
        localStorage.setItem("fcm_push_token", fcmToken);
        await syncTokenToFirestore(fcmToken);
        
        setSuccess("Web Push Notifications have been successfully integrated and activated!");
        playSynthesizedSound("link");
        triggerHapticFeedback("success");
        onTriggerToast("Push notifications successfully configured!", "success");
      } else {
        throw new Error("Failed to generate subscription token. Check network settings.");
      }
    } catch (err: any) {
      console.error("FCM Activation Failed:", err);
      setError(err.message || "An unexpected error occurred during setup.");
      playSynthesizedSound("error");
      triggerHapticFeedback("error");
      onTriggerToast("Failed to enable push notifications", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    playSynthesizedSound("click");
    triggerHapticFeedback("button");
    onTriggerToast("FCM push token copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestPush = () => {
    triggerHapticFeedback("button");
    if (permission !== "granted") {
      onTriggerToast("Please enable notifications before testing", "warning");
      return;
    }

    try {
      // Simulate/trigger a local browser notification as a demonstration
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification("TS Price Manager", {
            body: "🚀 Web Push Notifications setup is fully active and working perfectly!",
            icon: "/logo.png",
            badge: "/logo.png",
            vibrate: [200, 100, 200],
            tag: "fcm-test-notification",
            data: { url: window.location.origin }
          } as any);
          
          playSynthesizedSound("success");
          onTriggerToast("Test notification dispatched to service worker", "success");
        });
      } else {
        // Fallback to simple Notification
        new Notification("TS Price Manager", {
          body: "🚀 Web Push Notifications setup is active and working perfectly!",
          icon: "/logo.png"
        });
        playSynthesizedSound("success");
        onTriggerToast("Test notification dispatched", "success");
      }
    } catch (err) {
      console.error("Test notification failed:", err);
      onTriggerToast("Could not send native notification", "error");
    }
  };

  return (
    <div className="card p-8 bg-[var(--card)] border border-[var(--border)] rounded-[2.5rem] shadow-xl relative overflow-hidden text-left">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-sm">
            {permission === "granted" && token ? <BellRing size={20} className="animate-pulse" /> : <Bell size={20} />}
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Web Push Notifications</h3>
            <p className="text-[10px] font-bold text-[var(--foreground)]/40 uppercase tracking-wider font-mono">Firebase Cloud Messaging Integration</p>
          </div>
        </div>

        {permission === "granted" && token ? (
          <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            <Check size={10} /> Active
          </span>
        ) : permission === "denied" ? (
          <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            Blocked
          </span>
        ) : (
          <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            <BellOff size={10} /> Inactive
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--foreground)]/70 mb-6 leading-relaxed">
        Enable background and foreground Push Notifications to receive critical, real-time pricing alerts, stock updates, and system inventory changes directly on your desktop or mobile device.
      </p>

      {/* Sandbox frame helper */}
      {isIframe && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wide">AI Studio Sandbox Detected</p>
              <p className="text-[11px] text-amber-400/80 leading-relaxed font-medium">
                Web browsers restrict notification permission requests and Service Worker registrations inside sandboxed iframes (the preview panel). 
                To configure and test push notifications, click the link below to open this app in a standalone tab!
              </p>
            </div>
          </div>
          <a
            href={typeof window !== "undefined" ? window.location.origin : "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHapticFeedback("button")}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-widest py-2 px-4 rounded-xl transition-all font-sans text-center cursor-pointer"
          >
            Open in standalone tab 🚀
          </a>
        </div>
      )}

      {/* Message Banner Area */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3"
          >
            <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs text-emerald-300 font-bold uppercase tracking-wide">Configuration Active</p>
              <p className="text-[11px] text-emerald-400/80 font-medium">{success}</p>
            </div>
            <button 
              onClick={() => setSuccess(null)}
              className="ml-auto text-emerald-400 hover:text-white transition-colors cursor-pointer"
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
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
          >
            <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs text-red-300 font-bold uppercase tracking-wide">Setup Error</p>
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

        {testPayload && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Foreground Message Received</p>
              <button 
                onClick={() => setTestPayload(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            <pre className="text-[10px] font-mono text-indigo-200 bg-black/40 p-3 rounded-xl overflow-x-auto max-h-32">
              {JSON.stringify(testPayload, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="space-y-4">
        {permission === "denied" ? (
          <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-rose-300 font-bold uppercase tracking-wide">Permission Denied</p>
              <p className="text-[11px] text-rose-400/70 leading-normal">
                Please unlock or reset the Notification permissions for this site in your browser's address bar settings to subscribe to Push Alerts.
              </p>
            </div>
          </div>
        ) : !token ? (
          <button
            onClick={handleEnablePush}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-black uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-55 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Registering with Cloud...
              </>
            ) : (
              <>
                <BellRing size={14} /> Request & Enable Push Notifications
              </>
            )}
          </button>
        ) : (
          <div className="space-y-4">
            {/* Display and Copy FCM Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">FCM Registration Token</label>
                <button
                  onClick={handleCopyToken}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-green-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy Token
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={token}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 pr-12 text-[10px] font-mono text-[var(--foreground)]/80 select-all"
                />
              </div>
            </div>

            {/* Test buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleSendTestPush}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all border border-white/5 active:scale-95 cursor-pointer"
              >
                <Send size={14} /> Send Test Push Alert
              </button>
              <button
                onClick={handleEnablePush}
                disabled={loading}
                className="flex items-center justify-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider py-3 px-4 rounded-xl transition-all hover:bg-white/5 cursor-pointer"
                title="Refresh token registration"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : "Re-Register Token"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Mobile Guides & Diagnostic Tools */}
      <div className="mt-8 border-t border-[var(--border)] pt-6 space-y-4">
        
        {/* Toggle Mobile Integration Guide */}
        <div className="border border-[var(--border)] rounded-2xl bg-[var(--background)]/35 overflow-hidden">
          <button
            onClick={() => {
              setShowMobileGuides(!showMobileGuides);
              triggerHapticFeedback("button");
            }}
            className="w-full flex items-center justify-between p-4 text-left font-sans text-xs font-black uppercase tracking-widest text-[var(--foreground)]/90 hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Smartphone size={16} className="text-amber-400" />
              <span>Mobile Setup & PWA Guides</span>
            </span>
            {showMobileGuides ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          <AnimatePresence>
            {showMobileGuides && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-[var(--border)] p-4 bg-[var(--background)]/10 text-left space-y-4"
              >
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 mb-1">
                      🍎 For iOS / iPhone Users (Safari)
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium mb-2">
                      Apple <strong className="text-white">strictly requires</strong> that Web Apps be installed to your Home Screen before they can receive push notifications.
                    </p>
                    <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1 pl-1">
                      <li>Open this app in <strong className="text-white">Safari</strong> (standalone, not in the preview frame).</li>
                      <li>Tap the Safari <strong className="text-indigo-400">Share</strong> button (box with an arrow pointing up).</li>
                      <li>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.</li>
                      <li>Launch the app from your phone's home screen.</li>
                      <li>Sign in, navigate here, and tap <strong className="text-white">"Request & Enable Push"</strong>.</li>
                      <li>When prompted, select <strong className="text-green-400">Allow</strong>!</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-1">
                      🤖 For Android Users (Chrome / Edge / Firefox)
                    </h4>
                    <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1 pl-1">
                      <li>Make sure you are in a standalone browser tab.</li>
                      <li>Click <strong className="text-white">"Request & Enable Push Notifications"</strong> above.</li>
                      <li>When the browser asks "Allow notifications?", select <strong className="text-emerald-400 font-bold">Allow</strong>.</li>
                      <li>If you previously blocked notifications: tap the <strong className="text-amber-400">lock/info icon</strong> in Chrome's URL bar, tap <strong className="text-white">Permissions</strong>, and reset them.</li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toggle Mobile Diagnostics & Troubleshooter */}
        <div className="border border-[var(--border)] rounded-2xl bg-[var(--background)]/35 overflow-hidden">
          <button
            onClick={() => {
              setShowDiagnostics(!showDiagnostics);
              triggerHapticFeedback("button");
              refreshServiceWorkerList();
            }}
            className="w-full flex items-center justify-between p-4 text-left font-sans text-xs font-black uppercase tracking-widest text-[var(--foreground)]/90 hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Activity size={16} className="text-rose-400 animate-pulse" />
              <span>Mobile Troubleshooter & Diagnostics</span>
            </span>
            {showDiagnostics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          <AnimatePresence>
            {showDiagnostics && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-[var(--border)] p-4 bg-[var(--background)]/10 text-left space-y-4"
              >
                <div className="space-y-3.5">
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    Since you are on a mobile device and do not have browser Developer Tools, use these utility buttons to diagnose connection health and wipe stale workers or caches.
                  </p>

                  {/* Diagnostic Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleUnregisterAll}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 size={12} /> Wipe & Clear Service Workers
                    </button>
                    <button
                      onClick={handleCopyDiagnosticsReport}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all border border-white/5 cursor-pointer"
                    >
                      <Copy size={12} /> Export Diagnostics Report
                    </button>
                  </div>

                  {/* Active Service Workers List */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registered Service Workers</span>
                      <button 
                        onClick={() => {
                          refreshServiceWorkerList();
                          triggerHapticFeedback("button");
                        }} 
                        className="text-[9px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <RefreshCw size={10} /> Refresh
                      </button>
                    </div>
                    
                    {activeServiceWorkers.length === 0 ? (
                      <p className="text-[10px] text-slate-500 font-mono bg-black/20 p-3 rounded-xl border border-[var(--border)]">
                        No service workers are registered for this domain yet.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {activeServiceWorkers.map((sw, index) => (
                          <div 
                            key={index} 
                            className="flex flex-col gap-1 p-2.5 bg-black/30 border border-white/5 rounded-xl text-[10px] font-mono"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-bold truncate max-w-[70%]">{sw.scriptURL.split('/').pop()}</span>
                              <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                sw.state === 'active' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10' : 'bg-amber-500/15 text-amber-400 border border-amber-500/10'
                              }`}>
                                {sw.state}
                              </span>
                            </div>
                            <span className="text-[8px] text-slate-600 truncate break-all">{sw.scriptURL}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
