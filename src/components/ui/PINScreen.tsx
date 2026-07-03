import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Unlock, Delete as Backspace } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

interface PINScreenProps {
  onSuccess: () => void;
  correctPIN?: string | null;
  mode: 'unlock' | 'create' | 'confirm';
  onPINCreated?: (pin: string) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
}

export function PINScreen({ 
  onSuccess, 
  correctPIN, 
  mode, 
  onPINCreated, 
  onCancel,
  title,
  description 
}: PINScreenProps) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState(false);
  const [step, setStep] = React.useState<'first' | 'confirm'>(mode === 'create' ? 'first' : 'first');
  const [tempPin, setTempPin] = React.useState('');

  const handlePress = React.useCallback((digit: string) => {
    setPin(prev => {
      if (prev.length < 6) {
        return prev + digit;
      }
      return prev;
    });
  }, []);

  const handleBackspace = React.useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  // Physical Keyboard Support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePress, handleBackspace]);

  React.useEffect(() => {
    if (pin.length === 6) {
      if (mode === 'unlock') {
        if (pin === correctPIN) {
          onSuccess();
        } else {
          setError(true);
          setPin('');
          setTimeout(() => setError(false), 500);
        }
      } else if (mode === 'create') {
        if (step === 'first') {
          setTempPin(pin);
          setPin('');
          setStep('confirm');
        } else {
          if (pin === tempPin) {
            onPINCreated?.(pin);
            onSuccess();
          } else {
            setError(true);
            setPin('');
            setStep('first');
            setTimeout(() => setError(false), 500);
          }
        }
      }
    }
  }, [pin, mode, correctPIN, onSuccess, step, tempPin, onPINCreated]);

  const displayTitle = title || (mode === 'unlock' ? 'Enter PIN to Unlock' : step === 'first' ? 'Create Your PIN' : 'Confirm Your PIN');
  const displayDescription = description || (mode === 'unlock' ? 'Enter your 6-digit PIN to access buying prices' : step === 'first' ? 'Set a 6-digit PIN to secure your data' : 'Re-enter your PIN to confirm');

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.85, y: 12 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 18 } }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-2xl p-6"
    >
      {/* Decorative ambient glowing backdrops */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[25%] h-72 w-72 rounded-full bg-amber-500/10 blur-[100px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[25%] h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <motion.div 
        animate={error ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="w-full max-w-xs flex flex-col items-center relative z-10"
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 p-4 text-amber-500 shadow-xl"
        >
          {mode === 'unlock' ? <Lock size={32} className="animate-pulse" /> : <Unlock size={32} />}
        </motion.div>
        
        <h2 className="mb-2 text-2xl font-black text-white tracking-tight">{displayTitle}</h2>
        <p className="mb-8 text-center text-xs text-slate-400 max-w-[240px] leading-relaxed">{displayDescription}</p>

        {/* PIN Indicators with GPU-accelerated responsive transitions */}
        <div className="mb-12 flex space-x-4">
          {[...Array(6)].map((_, i) => {
            const isActive = pin.length > i;
            return (
              <div 
                key={i}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition-all duration-150 ease-out transform",
                  error 
                    ? "bg-red-500 border-red-500 scale-110 shadow-[0_0_12px_rgba(239,68,68,0.6)]" 
                    : isActive 
                      ? "bg-amber-500 border-amber-500 scale-115 shadow-[0_0_15px_rgba(245,158,11,0.6)]" 
                      : "bg-white/5 border-white/20 scale-100"
                )}
              />
            );
          })}
        </div>

        {/* Staggered, highly responsive keypad with oversized touch-friendly buttons */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 gap-6 sm:gap-8"
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <motion.div key={num} variants={itemVariants}>
              <button
                className="h-20 w-20 sm:h-24 sm:w-24 text-3xl sm:text-4xl font-black rounded-2xl border border-white/15 bg-white/5 hover:border-amber-500/40 hover:bg-amber-500/5 hover:scale-105 active:scale-90 active:bg-amber-500/25 active:border-amber-500/60 text-white transition-all duration-100 ease-out cursor-pointer shadow-lg active:shadow-inner flex items-center justify-center select-none outline-none"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handlePress(num);
                }}
              >
                {num}
              </button>
            </motion.div>
          ))}
          
          {/* Clear Button 'C' instead of empty space */}
          <motion.div variants={itemVariants}>
            <button
              className="h-20 w-20 sm:h-24 sm:w-24 text-2xl sm:text-3xl font-black rounded-2xl border border-white/10 bg-white/5 text-red-400 hover:border-red-500/30 hover:bg-red-500/10 hover:scale-105 active:scale-90 active:bg-red-500/20 active:border-red-500/50 transition-all duration-100 ease-out cursor-pointer shadow-lg flex items-center justify-center select-none outline-none"
              onPointerDown={(e) => {
                e.preventDefault();
                setPin('');
              }}
            >
              C
            </button>
          </motion.div>

          <motion.div variants={itemVariants}>
            <button
              className="h-20 w-20 sm:h-24 sm:w-24 text-3xl sm:text-4xl font-black rounded-2xl border border-white/15 bg-white/5 hover:border-amber-500/40 hover:bg-amber-500/5 hover:scale-105 active:scale-90 active:bg-amber-500/25 active:border-amber-500/60 text-white transition-all duration-100 ease-out cursor-pointer shadow-lg active:shadow-inner flex items-center justify-center select-none outline-none"
              onPointerDown={(e) => {
                e.preventDefault();
                handlePress('0');
              }}
            >
              0
            </button>
          </motion.div>

          <motion.div variants={itemVariants}>
            <button
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 hover:scale-105 active:scale-90 active:bg-white/10 text-slate-300 transition-all duration-100 ease-out cursor-pointer shadow-lg flex items-center justify-center select-none outline-none"
              onPointerDown={(e) => {
                e.preventDefault();
                handleBackspace();
              }}
            >
              <Backspace size={28} />
            </button>
          </motion.div>
        </motion.div>

        {onCancel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button variant="ghost" className="mt-8 text-amber-500 font-bold tracking-wider uppercase text-xs cursor-pointer hover:bg-amber-500/10 px-6 py-2 rounded-xl border border-transparent hover:border-amber-500/20" onClick={onCancel}>
              Cancel Secure Session
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
