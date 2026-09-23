import { useState } from 'react';
import { SupervisorQRDisplay } from './SupervisorQRDisplay';
import { FormField, FormSelect } from '@/shared/components/FormField';
import { Button } from '@/shared/components/ui/Button';
import { QrCode, Play, Square, Sparkles } from 'lucide-react';

export function SupervisorQRPage() {
  const [action, setAction] = useState<'time_in' | 'time_out'>('time_in');
  const [expiration, setExpiration] = useState<30 | 60 | 120 | 300>(60);
  const [isActive, setIsActive] = useState(false);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Control Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Attendance QR Generator</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate dynamic rotating QR codes for trainee daily time-in and time-out
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="action-select" label="Attendance Action">
            <FormSelect
              id="action-select"
              value={action}
              onValueChange={(val) => setAction(val as 'time_in' | 'time_out')}
            >
              <option value="time_in">Time In</option>
              <option value="time_out">Time Out</option>
            </FormSelect>
          </FormField>

          <FormField id="expiration-select" label="QR Rotation Expiration">
            <FormSelect
              id="expiration-select"
              value={String(expiration)}
              onValueChange={(val) => setExpiration(Number(val) as 30 | 60 | 120 | 300)}
            >
              <option value="30">30 seconds (High Security)</option>
              <option value="60">60 seconds (Standard)</option>
              <option value="120">2 minutes</option>
              <option value="300">5 minutes</option>
            </FormSelect>
          </FormField>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>Auto-refreshes 10s before expiry with anti-replay JWT nonce.</span>
          </div>

          <Button
            variant={isActive ? 'destructive' : 'primary'}
            size="md"
            onClick={() => setIsActive(!isActive)}
            className="gap-2 shrink-0"
          >
            {isActive ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                Stop QR
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Start QR
              </>
            )}
          </Button>
        </div>
      </div>

      {/* QR Display Screen */}
      <SupervisorQRDisplay
        action={action}
        expirationSeconds={expiration}
        isActive={isActive}
      />
    </div>
  );
}