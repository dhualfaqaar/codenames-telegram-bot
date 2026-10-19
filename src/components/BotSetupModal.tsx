import React, { useState } from 'react';
import { X, Key, CheckCircle, AlertCircle, Copy, ExternalLink, Play, Square, RefreshCw, ShieldCheck } from 'lucide-react';
import { BotConfig } from '../types/codenames';
import { useTheme } from '../context/ThemeContext';

interface BotSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  botConfig: BotConfig;
  onUpdateToken: (token: string, action: 'save' | 'test' | 'start' | 'stop') => Promise<any>;
}

export const BotSetupModal: React.FC<BotSetupModalProps> = ({
  isOpen,
  onClose,
  botConfig,
  onUpdateToken,
}) => {
  const { theme } = useTheme();
  const [tokenInput, setTokenInput] = useState(botConfig.token || '');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleAction = async (action: 'test' | 'start' | 'stop') => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await onUpdateToken(tokenInput, action);
      if (res?.success) {
        setFeedback({
          type: 'success',
          message: res.message || (action === 'test' ? 'تم التحقق من صحة التوكن بنجاح!' : 'تم التحديث بنجاح!'),
        });
      } else {
        setFeedback({
          type: 'error',
          message: res?.error || res?.message || 'حدث خطأ أثناء الاتصال بتلجرام.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'فشل الاتصال بالخادم.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isOnline = botConfig.isActive && botConfig.botInfo;
  const botUsername = botConfig.botInfo?.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
        dir="rtl"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b transition-colors"
          style={{
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.borderColor
          }}
        >
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: theme.colors.accentSubtle,
                color: theme.colors.accentPrimary
              }}
            >
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
                إعداد وتشغيل بوت تلجرام المباشر
              </h2>
              <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                اربط توكن البوت لتشغيل اللعبة في أي محادثة أو قروب على تلجرام
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
            style={{ color: theme.colors.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Quick Bot Status Card */}
          <div 
            className="p-4 rounded-xl border transition-all"
            style={{
              backgroundColor: isOnline ? (theme.isDark ? '#18392b' : '#e8f5e9') : theme.colors.bgInput,
              borderColor: isOnline ? '#00c853' : theme.colors.borderColor
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 rounded-full ${isOnline ? 'bg-[#00c853] animate-pulse' : 'bg-[#e53935]'}`} />
                <div>
                  <div className="font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
                    <span>حالة البوت:</span>
                    <span className={isOnline ? 'text-[#00c853]' : 'text-[#ef5350]'}>
                      {isOnline ? 'متصل وجاهز لاستقبال الرسائل في تلجرام 🚀' : 'غير متصل حالياً'}
                    </span>
                  </div>
                  {botUsername && (
                    <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
                      معرف البوت في تلجرام: <span className="font-mono font-bold" style={{ color: theme.colors.accentPrimary }}>@{botUsername}</span>
                    </p>
                  )}
                </div>
              </div>

              {isOnline && botUsername && (
                <a
                  href={`https://t.me/${botUsername}?startgroup=codenames`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition shadow"
                  style={{ backgroundColor: theme.colors.accentPrimary }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>إضافة لقروب تلجرام</span>
                </a>
              )}
            </div>
          </div>

          {/* Token Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold" style={{ color: theme.colors.textPrimary }}>
                رمز البوت (Telegram Bot Token)
              </label>
              {botConfig.hasToken && (
                <span className="text-[11px] font-bold text-[#00c853]">
                  ✓ التوكن مربوط وجاهز ({botConfig.tokenPreview || 'محفوظ بالسيرفر'})
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={botConfig.tokenPreview ? `التوكن محفوظ بالسيرفر (${botConfig.tokenPreview}) - اتركه فارغاً أو أدخل توكناً جديداً` : "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ..."}
                className="w-full border rounded-xl px-4 py-2.5 text-xs font-mono outline-none transition"
                style={{
                  backgroundColor: theme.colors.bgInput,
                  borderColor: theme.colors.borderColor,
                  color: theme.colors.textPrimary
                }}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute left-3 top-2.5 text-xs hover:opacity-80"
                style={{ color: theme.colors.textMuted }}
              >
                {showToken ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
            <p className="text-[11px]" style={{ color: theme.colors.textMuted }}>
              يمكنك الحصول على هذا التوكن مجاناً وبثوانٍ معدودة من بوت تلجرام الرسمي <span className="font-mono font-bold" style={{ color: theme.colors.accentPrimary }}>@BotFather</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAction('test')}
              disabled={loading || (!tokenInput && !botConfig.hasToken)}
              className="px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor,
                color: theme.colors.textPrimary
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>فحص الاتصال والتوكن</span>
            </button>

            {!isOnline ? (
              <button
                onClick={() => handleAction('start')}
                disabled={loading || (!tokenInput && !botConfig.hasToken)}
                className="px-5 py-2 rounded-xl bg-[#00c853] hover:bg-[#00b047] text-black text-xs font-bold flex items-center gap-1.5 transition shadow disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>تشغيل البوت المباشر (Long Polling)</span>
              </button>
            ) : (
              <button
                onClick={() => handleAction('stop')}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[#e53935] hover:bg-[#d32f2f] text-white text-xs font-bold flex items-center gap-1.5 transition shadow disabled:opacity-40"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>إيقاف البوت مؤقتاً</span>
              </button>
            )}

            {botConfig.mode === 'webhook' ? (
              <button
                onClick={() => handleAction('remove_webhook' as any)}
                disabled={loading}
                className="px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow bg-[#2b5278] text-white"
              >
                <span>إلغاء وضع الويب هوك 🔄</span>
              </button>
            ) : (
              <button
                onClick={() => handleAction('set_webhook' as any)}
                disabled={loading || (!tokenInput && !botConfig.hasToken)}
                className="px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 shadow-xs cursor-pointer active:scale-95"
                style={{
                  backgroundColor: theme.colors.accentSubtle,
                  borderColor: theme.colors.accentPrimary,
                  color: theme.colors.accentPrimary
                }}
                title="ربط البوت عبر Webhook ليستيقظ تلقائياً عند أي رسالة"
              >
                <span>تفعيل الويب هوك السحابي (Webhook 24/7) 🌐</span>
              </button>
            )}
          </div>

          {/* 24/7 Explanation Box */}
          <div 
            className="p-4 rounded-xl border space-y-2 text-xs transition-colors"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor
            }}
          >
            <div className="flex items-center gap-2 font-bold" style={{ color: theme.colors.textPrimary }}>
              <span className="text-base">⏰</span>
              <span>هل يبقى البوت شغالاً دائماً (24/7)؟</span>
            </div>
            <div className="space-y-1.5 leading-relaxed" style={{ color: theme.colors.textSecondary }}>
              <p>
                • <strong>في بيئة المعاينة الحالية:</strong> يعمل البوت ويستقبل الرسائل مباشرة، ولكن بيئة المعاينة قد تدخل في وضع الخمول عند إغلاق المتصفح لفترة.
              </p>
              <p>
                • <strong>لضمان استيقاظ البوت عند أي رسالة:</strong> اضغط على <span className="font-bold text-[#00c853]">تفعيل الويب هوك السحابي (Webhook 24/7)</span>. حينها يقوم تلجرام نفسه بإيقاظ السيرفر فور إرسال أي أمر في القروب!
              </p>
              <p>
                • <strong>لتشغيله دائماً على مدار العام وبشكل مستقل:</strong> الكود كامل وجاهز للتشغيل بأمر واحد (<code className="font-mono px-1 py-0.5 rounded border" style={{ backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderColor }}>npm start</code>) على أي سيرفر أو استضافة سحابية مجانية (مثل Render أو Railway أو VPS).
              </p>
            </div>

            <div className="pt-2 border-t mt-2 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderColor: theme.colors.borderColor }}>
              <span className="text-[11px]" style={{ color: theme.colors.textMuted }}>
                لست بحاجة لكتابة الكود بنفسك، يمكنك تحميل ملفات المشروع الآن بضغطة زر:
              </span>
              <a
                href="/api/download-zip"
                download="codenames-bot.zip"
                className="px-4 py-2 rounded-xl text-black bg-[#00c853] hover:bg-[#00b047] font-bold text-xs flex items-center gap-1.5 transition shadow"
              >
                <span>📦 تحميل ملفات البوت (ZIP)</span>
              </a>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
              feedback.type === 'success'
                ? 'bg-[#18392b] border-[#00c853]/40 text-[#a5d6a7]'
                : 'bg-[#3e2723] border-[#e53935]/40 text-[#ef9a9a]'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-[#00c853]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#ef5350]" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Step-by-Step Guide for BotFather */}
          <div 
            className="border rounded-xl p-4 space-y-3 transition-colors"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor
            }}
          >
            <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
              <ShieldCheck className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
              <span>كيف تصنع بوت كود نيمز مجاناً في دقيقة واحدة؟</span>
            </h3>

            <ol className="space-y-2.5 text-xs list-decimal list-inside pr-1 leading-relaxed" style={{ color: theme.colors.textSecondary }}>
              <li>
                افتح تطبيق تلجرام وابحث عن بوت <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline font-bold" style={{ color: theme.colors.accentPrimary }}>@BotFather</a> الرسمي.
              </li>
              <li>
                أرسل له الأمر: <code className="px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderColor }}>/newbot</code> ثم اكتب اسماً للبوت، ثم معرفاً ينتهي بـ <code className="px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderColor }}>bot</code>.
              </li>
              <li>
                سيعطيك <code className="text-[#00c853] font-bold">HTTP API token</code>. انسخه والصقه في الحقل أعلاه واضغط (تشغيل البوت في تلجرام).
              </li>
              <li>
                <span className="text-[#ffb74d] font-bold">خطوة مهمة لقراءة رسائل المجموعات:</span> في <span className="font-mono">@BotFather</span>، اكتب <code className="px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderColor }}>/setprivacy</code> ثم اختر بوتك ثم اضغط <code className="text-[#00c853] font-bold">Disable</code> لكي يتمكن من قراءة أوامر اللعبة في المجموعات!
              </li>
              <li>
                أضف البوت إلى مجموعتك في تلجرام، ثم اكتب <code className="px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderColor, color: theme.colors.accentPrimary }}>/newgame</code> وابدأ اللعب!
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-3.5 border-t flex items-center justify-between transition-colors"
          style={{
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.borderColor
          }}
        >
          <span className="text-xs" style={{ color: theme.colors.textMuted }}>
            يمكنك أيضاً تجربة اللعبة بالكامل في تبويب "محاكي محادثة تلجرام" بدون توكن!
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border text-xs font-bold transition"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor,
              color: theme.colors.textPrimary
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
