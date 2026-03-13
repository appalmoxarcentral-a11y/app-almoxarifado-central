import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface PaymentCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentCelebration({ isOpen, onClose }: PaymentCelebrationProps) {
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (isOpen) {
      // Fire confetti multiple times for a richer effect
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Since particles fall down, start a bit higher than random
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // 10 second countdown to close
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
        clearInterval(timer);
      };
    } else {
      setTimeLeft(10);
    }
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)] text-white overflow-hidden p-0 border-2">
        <div className="relative p-8 flex flex-col items-center text-center space-y-6">
          {/* Decorative background flare */}
          <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] -z-10" />
          
          <div className="bg-emerald-500/20 p-4 rounded-full animate-bounce">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-white uppercase">
              Pagamento Confirmado!
            </h2>
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold">
              <PartyPopper className="h-5 w-5" />
              <span className="text-lg">Parabéns, sua fatura foi paga com sucesso</span>
              <PartyPopper className="h-5 w-5" />
            </div>
          </div>

          <p className="text-slate-400 text-sm">
            Seu acesso foi totalmente restabelecido e os limites do seu plano foram atualizados.
          </p>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / 10) * 100}%` }}
            />
          </div>
          
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Fechando em {timeLeft} segundos...
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
