import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "INR", precision: number = 0): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(amount);
}

export function formatNumber(num: number, precision: number = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(num);
}

export type HapticType =
  | 'navigation'
  | 'calculator'
  | 'billing'
  | 'button'
  | 'save'
  | 'download'
  | 'popup'
  | 'long_press'
  | 'error'
  | 'success';

export function triggerHapticFeedback(type: HapticType | number = 'button', customSettings?: any) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  // Retrieve settings
  let settings: any = customSettings;
  if (!settings) {
    try {
      const saved = localStorage.getItem('price_manager_settings');
      if (saved) {
        settings = JSON.parse(saved);
      }
    } catch (e) {
      // Ignored
    }
  }

  // If no settings are found, default to active master and light intensity
  const hapticMaster = settings?.hapticMaster ?? true;
  if (!hapticMaster) return;

  // Check specific toggles
  if (typeof type === 'string') {
    if (type === 'navigation' && !(settings?.hapticNavigation ?? true)) return;
    if (type === 'calculator' && !(settings?.hapticCalculator ?? true)) return;
    if (type === 'billing' && !(settings?.hapticBilling ?? true)) return;
    if (type === 'button' && !(settings?.hapticButton ?? true)) return;
    if (type === 'save' && !(settings?.hapticSave ?? true)) return;
    if (type === 'download' && !(settings?.hapticDownload ?? true)) return;
    if (type === 'popup' && !(settings?.hapticPopup ?? true)) return;
    if (type === 'long_press' && !(settings?.hapticLongPress ?? true)) return;
    if (type === 'error' && !(settings?.hapticError ?? true)) return;
    if (type === 'success' && !(settings?.hapticSuccess ?? true)) return;
  }

  const intensity = settings?.hapticIntensity || 'light';

  let pattern: number | number[] = 15;

  if (typeof type === 'number') {
    pattern = type;
  } else {
    switch (intensity) {
      case 'very_light':
        if (type === 'save' || type === 'success') {
          pattern = [10, 30, 10];
        } else if (type === 'error') {
          pattern = [8, 40, 8, 40];
        } else if (type === 'long_press') {
          pattern = 20;
        } else if (type === 'navigation') {
          pattern = 4;
        } else if (type === 'calculator') {
          pattern = 4;
        } else {
          pattern = 5;
        }
        break;
      case 'light':
        if (type === 'save' || type === 'success') {
          pattern = [15, 40, 15];
        } else if (type === 'error') {
          pattern = [12, 50, 12, 50];
        } else if (type === 'long_press') {
          pattern = 30;
        } else if (type === 'navigation') {
          pattern = 8;
        } else if (type === 'calculator') {
          pattern = 10;
        } else {
          pattern = 12;
        }
        break;
      case 'medium':
        if (type === 'save' || type === 'success') {
          pattern = [30, 50, 30];
        } else if (type === 'error') {
          pattern = [20, 60, 20, 60];
        } else if (type === 'long_press') {
          pattern = 45;
        } else if (type === 'navigation') {
          pattern = 15;
        } else if (type === 'calculator') {
          pattern = 18;
        } else {
          pattern = 22;
        }
        break;
      case 'strong':
        if (type === 'save' || type === 'success') {
          pattern = [50, 60, 50];
        } else if (type === 'error') {
          pattern = [35, 70, 35, 70];
        } else if (type === 'long_press') {
          pattern = 60;
        } else if (type === 'navigation') {
          pattern = 30;
        } else if (type === 'calculator') {
          pattern = 35;
        } else {
          pattern = 40;
        }
        break;
    }
  }

  try {
    navigator.vibrate(pattern);
  } catch (e) {
    // Ignored
  }
}

export function playSynthesizedSound(type: 'success' | 'error' | 'link' | 'click') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    
    if (type === 'success') {
      // Ascending chime: C5 (523.25) -> E5 (659.25) -> G5 (783.99) -> C6 (1046.50)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.3);
        
        osc.start(audioCtx.currentTime + i * 0.1);
        osc.stop(audioCtx.currentTime + i * 0.1 + 0.35);
      });
    } else if (type === 'link') {
      // Warm lock/link chime: E4 (329.63) -> B4 (493.88) -> E5 (659.25)
      const notes = [329.63, 493.88, 659.25];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.4);
        
        osc.start(audioCtx.currentTime + i * 0.12);
        osc.stop(audioCtx.currentTime + i * 0.12 + 0.45);
      });
    } else if (type === 'error') {
      // Low dual warning beep
      [180, 150].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.25);
        
        osc.start(audioCtx.currentTime + i * 0.15);
        osc.stop(audioCtx.currentTime + i * 0.15 + 0.3);
      });
    } else {
      // Soft tap
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.06);
    }
  } catch (e) {
    // Ignore context blocked / disabled
  }
}


