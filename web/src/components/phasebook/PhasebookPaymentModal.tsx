import React, { useState } from 'react';
import {
  CreditCard,
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface PhasebookPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  amount?: number;
}

export const PhasebookPaymentModal: React.FC<PhasebookPaymentModalProps> = ({
  isOpen,
  onClose,
  title = 'Phasebook Plus Subscription',
  amount = 4.99,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    message: string;
    transactionId?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setIsProcessing(true);
    setPaymentResult(null);

    try {
      const resp = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          purpose: title,
        }),
      });

      const data = await resp.json();

      if (resp.ok && data.success) {
        setPaymentResult({
          success: true,
          message: data.message || 'Payment authorized successfully!',
          transactionId: data.transactionId,
        });
      } else {
        setPaymentResult({
          success: false,
          message: `${data.error || 'Payment Failure'}: ${data.message || 'Payment gateway connection error'}`,
        });
      }
    } catch (err: any) {
      setPaymentResult({
        success: false,
        message: err.message || 'Network error connecting to payment gateway',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="relative bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">Phasebook Secure Billing Gateway</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {paymentResult?.success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Payment Completed</h4>
                <p className="text-xs text-slate-500 mt-1">{paymentResult.message}</p>
                {paymentResult.transactionId && (
                  <p className="font-mono text-[11px] text-slate-400 mt-2 bg-slate-100 p-2 rounded-lg">
                    Txn: {paymentResult.transactionId}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full bg-[#1877F2] hover:bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl transition-colors mt-2"
              >
                Close & Return
              </button>
            </div>
          ) : (
            <>
              {/* Amount Summary */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total due today</p>
                  <p className="text-xl font-extrabold text-slate-900">${amount.toFixed(2)} USD</p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-full">
                  Monthly Plan
                </span>
              </div>

              {/* Demo Card Inputs */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 block">Payment Method</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled
                    value="•••• •••• •••• 4242 (Simulated Card)"
                    className="w-full bg-slate-100 text-xs font-mono text-slate-600 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Payment Error Alert */}
              {paymentResult && !paymentResult.success && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Transaction Declined</span>
                  </div>
                  <p className="font-mono text-[11px] text-red-700 break-words leading-relaxed pl-5">
                    {paymentResult.message}
                  </p>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full bg-[#1877F2] hover:bg-blue-600 disabled:bg-slate-300 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authorizing with Mock Payment Gateway...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Pay ${amount.toFixed(2)} USD</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> End-to-end encrypted demo payment tunnel
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
