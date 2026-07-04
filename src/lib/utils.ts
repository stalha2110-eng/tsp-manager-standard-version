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

export type SoundType = 'success' | 'error' | 'link' | 'click' | 'save' | 'add' | 'delete' | 'notification';

export function playSynthesizedSound(type: SoundType) {
  try {
    // Check global settings for sound
    let soundMaster = true;
    try {
      const saved = localStorage.getItem('price_manager_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.soundMaster !== undefined) {
          soundMaster = parsed.soundMaster;
        }
      }
    } catch (e) {
      // Ignored
    }
    if (!soundMaster) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    
    if (type === 'save') {
      // Premium invoice/bill checkout arpeggio: a warm chord arpeggio with a shimmering finish
      const notes = [392.00, 493.88, 587.33, 783.99, 1046.50, 1318.51]; // G4 -> B4 -> D5 -> G5 -> C6 -> E6
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        // Use a triangle oscillator for a warmer, richer, organic acoustic instrument sound
        osc.type = i < 3 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.04);
        
        // Attack-Decay envelope
        gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.04);
        gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + i * 0.04 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.04 + 0.4);
        
        osc.start(audioCtx.currentTime + i * 0.04);
        osc.stop(audioCtx.currentTime + i * 0.04 + 0.45);
      });
    } else if (type === 'add') {
      // Tactile bubble pop / click pop: extremely satisfying high-speed glide
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      // Fast pitch glide: 600Hz to 1200Hz
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.06);
      
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } else if (type === 'delete') {
      // Subtly sliding downward tone for removal feedback
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } else if (type === 'notification') {
      // Rich ambient glass chime: two beautiful resonant notes played together
      const notes = [880.00, 1109.00]; // A5 and C#6
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.05);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.05);
        gain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + i * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.05 + 0.6);
        
        osc.start(audioCtx.currentTime + i * 0.05);
        osc.stop(audioCtx.currentTime + i * 0.05 + 0.75);
      });
    } else if (type === 'success') {
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
      // Soft tactile click
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    }
  } catch (e) {
    // Ignore context blocked / disabled
  }
}


