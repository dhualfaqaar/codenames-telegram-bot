import React from 'react';
import { HelpCircle, Shield, Award, AlertTriangle, Send, Command, Zap } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const RulesGuide: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div 
        className="p-5 rounded-2xl border shadow-sm flex items-center gap-3 transition-colors"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <div 
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs"
          style={{
            backgroundColor: theme.colors.accentSubtle,
            color: theme.colors.accentPrimary
          }}
        >
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
            دليل وقوانين لعبة كود نيمز (Codenames) في تلجرام
          </h2>
          <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
            كل ما تحتاجه للعب واحتراف اللعبة داخل مجموعات وكروبات تلجرام
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: What is Codenames */}
        <div 
          className="border rounded-2xl p-5 space-y-3 transition-colors shadow-xs"
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: theme.colors.borderColor
          }}
        >
          <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
            <Award className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
            <span>ما هي لعبة كود نيمز؟</span>
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: theme.colors.textSecondary }}>
            لعبة تخمين ذكاء جماعية شهيرة عالمياً. يتم عرض لوحة تحتوي على <strong style={{ color: theme.colors.textPrimary }}>25 كلمة</strong> مشفرة. ينقسم اللاعبون إلى فريقين: <span className="text-[#2481cc] font-bold">الفريق الأزرق 🔵</span> و <span className="text-[#ef5350] font-bold">الفريق الأحمر 🔴</span>.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: theme.colors.textSecondary }}>
            الفريق الذي يتمكن من كشف جميع بطاقات عملائه أولاً يفوز باللعبة!
          </p>
        </div>

        {/* Card 2: Roles */}
        <div 
          className="border rounded-2xl p-5 space-y-3 transition-colors shadow-xs"
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: theme.colors.borderColor
          }}
        >
          <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
            <Shield className="w-4 h-4 text-[#00c853]" />
            <span>الأدوار داخل كل فريق:</span>
          </h3>
          <ul className="text-xs space-y-2 leading-relaxed" style={{ color: theme.colors.textSecondary }}>
            <li>
              <strong style={{ color: theme.colors.textPrimary }}>1. القائد الجاسوس (Spymaster 🕵️‍♂️):</strong>
              <br />
              شخص واحد في كل فريق يرى <span className="text-[#ffca28] font-bold">الخريطة السرية</span> كاملة مع ألوان البطاقات. مهمته إعطاء تلميح من كلمة واحدة ورقم يربط أكبر عدد من بطاقات فريقه.
            </li>
            <li>
              <strong style={{ color: theme.colors.textPrimary }}>2. العملاء الميدانيون (Operatives 👥):</strong>
              <br />
              باقي أعضاء الفريق. يناقشون التلميح في محادثة تلجرام ويضغطون على أزرار الكلمات لتخمينها!
            </li>
          </ul>
        </div>
      </div>

      {/* The 4 Card Types */}
      <div 
        className="border rounded-2xl p-5 space-y-4 transition-colors shadow-xs"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <h3 className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>أنواع البطاقات الـ 25 على اللوحة:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div 
            className="p-3.5 rounded-xl border space-y-1"
            style={{
              backgroundColor: theme.isDark ? '#132c45' : '#e3f2fd',
              borderColor: '#2481cc'
            }}
          >
            <div className="font-bold text-xs text-[#2481cc] flex items-center gap-1.5">
              <span>🔵 عملاء الأزرق (8-9 بطاقات)</span>
            </div>
            <p className="text-[11px] text-[#1e88e5] leading-relaxed">
              إذا ضغط عملاء الأزرق عليها، تُكشف ويستمر دورهم في التخمين!
            </p>
          </div>

          <div 
            className="p-3.5 rounded-xl border space-y-1"
            style={{
              backgroundColor: theme.isDark ? '#3b1718' : '#ffebee',
              borderColor: '#ef5350'
            }}
          >
            <div className="font-bold text-xs text-[#ef5350] flex items-center gap-1.5">
              <span>🔴 عملاء الأحمر (8-9 بطاقات)</span>
            </div>
            <p className="text-[11px] text-[#e53935] leading-relaxed">
              إذا ضغط الفريق عليها بالخطأ، تحتسب نقطة للفريق المنافس وينتهي الدور فوراً!
            </p>
          </div>

          <div 
            className="p-3.5 rounded-xl border space-y-1"
            style={{
              backgroundColor: theme.isDark ? '#263238' : '#eceff1',
              borderColor: '#78909c'
            }}
          >
            <div className="font-bold text-xs text-[#546e7a] flex items-center gap-1.5">
              <span>⚪ مدنيون أبرياء (7 بطاقات)</span>
            </div>
            <p className="text-[11px] text-[#78909c] leading-relaxed">
              أشخاص محايدون لا يتبعون لأي فريق. كشف بطاقتهم ينهي دور الفريق فوراً.
            </p>
          </div>

          <div 
            className="p-3.5 rounded-xl border space-y-1 bg-black"
            style={{
              borderColor: '#d32f2f'
            }}
          >
            <div className="font-bold text-xs text-[#ff5252] flex items-center gap-1.5">
              <span>💣 بطاقة القاتل (بطاقة واحدة)</span>
            </div>
            <p className="text-[11px] text-[#ff8a80] leading-relaxed">
              احذروا منها! الفريق الذي يلمس بطاقة القاتل يخسر اللعبة فوراً دون تردد!
            </p>
          </div>
        </div>
      </div>

      {/* Clues and Guessing Rules */}
      <div 
        className="border rounded-2xl p-5 space-y-3 transition-colors shadow-xs"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
          <Zap className="w-4 h-4 text-[#ffca28]" />
          <span>قواعد التلميح والتخمين:</span>
        </h3>
        <ol className="space-y-2 text-xs list-decimal list-inside leading-relaxed" style={{ color: theme.colors.textSecondary }}>
          <li>
            <strong style={{ color: theme.colors.textPrimary }}>كلمة واحدة فقط:</strong> لا يجوز للقائد أن يرسل جملة أو كلمتين مركبتين (مثال صحيح: <code className="text-[#2481cc]">سماء</code>، مثال خاطئ: <code className="text-[#ef5350]">السماء الزرقاء</code>).
          </li>
          <li>
            <strong style={{ color: theme.colors.textPrimary }}>ممنوع ذكر أي كلمة من اللوحة:</strong> لا يجوز للقائد استخدام أي كلمة أو مشتق مباشر لكلمة غير مكشوفة على اللوحة.
          </li>
          <li>
            <strong style={{ color: theme.colors.textPrimary }}>عدد المحاولات:</strong> يحق لعملاء الفريق تخمين عدد الكلمات التي حددها القائد + محاولة واحدة إضافية (Bonus).
          </li>
          <li>
            <strong style={{ color: theme.colors.textPrimary }}>إنهاء الدور اختيارياً:</strong> يمكن للعملاء الضغط على زر <code className="text-[#ffca28]">⏭️ إنهاء التخمين (Pass)</code> في أي وقت للحفاظ على نقاطهم ونقل الدور للفريق الآخر.
          </li>
        </ol>
      </div>

      {/* Bot Commands List */}
      <div 
        className="border rounded-2xl p-5 space-y-3 transition-colors shadow-xs"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
          <Command className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
          <span>أوامر بوت تلجرام المستخدمة في المحادثات:</span>
        </h3>

        <div className="divide-y text-xs" style={{ borderColor: theme.colors.borderColor }}>
          <div className="py-2.5 flex items-start justify-between gap-4">
            <div>
              <code className="font-bold font-mono" style={{ color: theme.colors.accentPrimary }}>/newgame</code>
              <p className="text-[11px] mt-0.5" style={{ color: theme.colors.textMuted }}>بدء جولة جديدة وفتح أزرار الانضمام للفرق في المجموعة</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: theme.colors.bgInput, color: theme.colors.textSecondary }}>في الكروب</span>
          </div>

          <div className="py-2.5 flex items-start justify-between gap-4">
            <div>
              <code className="text-[#ffca28] font-bold font-mono">/clue &lt;الكلمة&gt; &lt;العدد&gt;</code>
              <p className="text-[11px] mt-0.5" style={{ color: theme.colors.textMuted }}>إرسال تلميح القائد مع عدد الكلمات، مثل: <span className="font-mono" style={{ color: theme.colors.textPrimary }}>/clue سماء 2</span></p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: theme.colors.bgInput, color: theme.colors.textSecondary }}>للقائد</span>
          </div>

          <div className="py-2.5 flex items-start justify-between gap-4">
            <div>
              <code className="font-bold font-mono" style={{ color: theme.colors.textSecondary }}>/pass</code>
              <p className="text-[11px] mt-0.5" style={{ color: theme.colors.textMuted }}>إنهاء دور التخمين اختيارياً ونقل الدور للفريق الآخر</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: theme.colors.bgInput, color: theme.colors.textSecondary }}>للعملاء</span>
          </div>

          <div className="py-2.5 flex items-start justify-between gap-4">
            <div>
              <code className="text-[#2481cc] font-bold font-mono">/map</code>
              <p className="text-[11px] mt-0.5" style={{ color: theme.colors.textMuted }}>يرسل البوت الخريطة السرية للقائد في محادثة خاصة (DM)</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: theme.colors.bgInput, color: theme.colors.textSecondary }}>خاص</span>
          </div>

          <div className="py-2.5 flex items-start justify-between gap-4">
            <div>
              <code className="text-[#00c853] font-bold font-mono">/rules</code>
              <p className="text-[11px] mt-0.5" style={{ color: theme.colors.textMuted }}>عرض ملخص القوانين وكيفية اللعب مباشرة في الشات</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: theme.colors.bgInput, color: theme.colors.textSecondary }}>للجميع</span>
          </div>
        </div>
      </div>

      {/* Render 24/7 Deployment Step-by-Step Guide */}
      <div 
        className="border rounded-2xl p-6 space-y-4 transition-colors shadow-sm"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <div className="flex items-center gap-2.5 border-b pb-3" style={{ borderColor: theme.colors.borderColor }}>
          <span className="text-xl">🚀</span>
          <div>
            <h3 className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
              دليل رفع البوت على استضافة Render المجانية (24/7) خطوة بخطوة
            </h3>
            <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
              إليك الخيارات الصحيحة لاختيارها في Render حتى لا تحتار بين الخيارات الكثيرة:
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl border space-y-1.5" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
            <div className="font-bold flex items-center gap-2" style={{ color: theme.colors.accentPrimary }}>
              <span className="w-5 h-5 rounded-full bg-[#00c853] text-black text-[10px] flex items-center justify-center font-bold">1</span>
              <span>أي خيار تختار من بين الخيارات الكثيرة في Render؟</span>
            </div>
            <p className="leading-relaxed pr-7" style={{ color: theme.colors.textSecondary }}>
              عند الضغط على <strong style={{ color: theme.colors.textPrimary }}>New +</strong> في لوحة تحكم Render، ستظهر لك خيارات مثل (Web Service, Static Site, Background Worker, PostgreSQL...).
              <br />
              👉 <strong className="text-[#00c853]">اختر دائماً: Web Service</strong> (لأن بوتنا مبني مع سيرفر ويب متكامل يستقبل الأوامر).
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl border space-y-2.5" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
            <div className="font-bold flex items-center justify-between gap-2" style={{ color: theme.colors.accentPrimary }}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#00c853] text-black text-[10px] flex items-center justify-center font-bold">2</span>
                <span>كيف تحصل على ملفات البوت وترفعها إلى GitHub؟</span>
              </div>
              <a
                href="/api/download-zip"
                download="codenames-bot.zip"
                className="px-3.5 py-1.5 rounded-xl bg-[#00c853] hover:bg-[#00b047] text-black text-xs font-bold transition shadow"
              >
                📥 حمّل ملفات البوت الآن (ZIP)
              </a>
            </div>
            <div className="leading-relaxed pr-7 space-y-1" style={{ color: theme.colors.textSecondary }}>
              <p>1. اضغط على الزر الأخضر أعلاه <strong className="text-[#00c853]">"حمّل ملفات البوت الآن (ZIP)"</strong> وسينزل ملف مضغوط في جهازك.</p>
              <p>2. فك الضغط عن الملف في جهازك.</p>
              <p>3. افتح <a href="https://github.com/new" target="_blank" rel="noreferrer" className="underline font-bold" style={{ color: theme.colors.accentPrimary }}>GitHub.com/new</a> وسَمِّ المستودع <code className="px-1 py-0.5 rounded border" style={{ backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderColor }}>codenames-bot</code> ثم اضغط <strong>Create repository</strong>.</p>
              <p>4. في الصفحة التي تظهر لك في GitHub، اضغط على <strong>uploading an existing file</strong> واسحب الملفات المفكوكة وأفلتها هناك ثم اضغط <strong>Commit changes</strong>.</p>
              <p>5. الآن في Render اختر هذا المستودع بكل سهولة!</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl border space-y-2" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
            <div className="font-bold flex items-center gap-2" style={{ color: theme.colors.accentPrimary }}>
              <span className="w-5 h-5 rounded-full bg-[#00c853] text-black text-[10px] flex items-center justify-center font-bold">3</span>
              <span>الحقول المطلوب ملؤها في صفحة الإعدادات:</span>
            </div>
            <div className="pr-7 space-y-1.5 font-mono text-[11px]" style={{ color: theme.colors.textSecondary }}>
              <div>• <strong>Name:</strong> <span style={{ color: theme.colors.accentPrimary }}>codenames-telegram-bot</span> (أو أي اسم تفضله)</div>
              <div>• <strong>Runtime / Environment:</strong> <span style={{ color: theme.colors.accentPrimary }}>Node</span></div>
              <div>• <strong>Build Command:</strong> <span className="bg-black/30 px-2 py-0.5 rounded text-white">npm install && npm run build</span></div>
              <div>• <strong>Start Command:</strong> <span className="bg-black/30 px-2 py-0.5 rounded text-white">npm start</span></div>
              <div>• <strong>Instance Type:</strong> اختر <span className="text-[#00c853] font-bold">Free ($0/month)</span> المجانية تماماً.</div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 rounded-xl border space-y-2" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
            <div className="font-bold flex items-center gap-2" style={{ color: theme.colors.accentPrimary }}>
              <span className="w-5 h-5 rounded-full bg-[#00c853] text-black text-[10px] flex items-center justify-center font-bold">4</span>
              <span>إضافة توكن البوت (Environment Variables):</span>
            </div>
            <p className="leading-relaxed pr-7" style={{ color: theme.colors.textSecondary }}>
              انزل لأسفل واضغط على زر <strong style={{ color: theme.colors.accentPrimary }}>Add Environment Variable</strong> وأدخل:
            </p>
            <div className="pr-7 font-mono text-[11px] space-y-1">
              <div>• <strong>Key:</strong> <span className="text-[#ffca28]">TELEGRAM_BOT_TOKEN</span></div>
              <div>• <strong>Value:</strong> <span style={{ color: theme.colors.textMuted }}>رمز التوكن الذي نسخته من @BotFather</span></div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="p-3.5 rounded-xl border space-y-1.5" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
            <div className="font-bold flex items-center gap-2" style={{ color: theme.colors.accentPrimary }}>
              <span className="w-5 h-5 rounded-full bg-[#00c853] text-black text-[10px] flex items-center justify-center font-bold">5</span>
              <span>الضغط على نشر (Deploy Web Service):</span>
            </div>
            <p className="leading-relaxed pr-7" style={{ color: theme.colors.textSecondary }}>
              اضغط الزر الأزرق في الأسفل <strong className="text-[#00c853]">Create Web Service</strong> وسيقوم Render ببناء البوت وتشغيله مباشرة، وسيعطيك رابطاً دائماً مثل <code className="text-[#2481cc]">https://codenames-bot.onrender.com</code> وسيعمل البوت في تلجرام 24/7 دون الحاجة لفتح المتصفح!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
