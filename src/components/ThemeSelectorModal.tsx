import React from 'react';
import { X, Palette, Check, Sun, Moon, Sparkles, Eye } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ThemeId } from '../types/theme';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({ isOpen, onClose }) => {
  const { currentThemeId, setThemeId, availableThemes, theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl">
      <div 
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
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
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{
                backgroundColor: theme.colors.accentSubtle,
                color: theme.colors.accentPrimary
              }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
                تخصيص ثيم ومظهر واجهة البوت
              </h2>
              <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                اختر الثيم الأنسب لراحتك أثناء إدارة اللعبة ومتابعة محادثات تلجرام
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

        {/* Content: Theme Cards Grid */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {availableThemes.map((t) => {
              const isSelected = t.id === currentThemeId;

              return (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between relative group ${
                    isSelected
                      ? 'ring-2 shadow-lg scale-[1.01]'
                      : 'hover:scale-[1.005]'
                  }`}
                  style={{
                    backgroundColor: t.colors.bgSurface,
                    borderColor: isSelected ? t.colors.accentPrimary : t.colors.borderColor,
                    boxShadow: isSelected ? `0 0 0 2px ${t.colors.accentPrimary}` : undefined
                  }}
                >
                  {/* Top Bar with Icon and Selected Check */}
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: t.colors.textPrimary }}>
                        {t.name}
                      </span>
                      {t.isDark ? (
                        <Moon className="w-3.5 h-3.5" style={{ color: t.colors.textMuted }} />
                      ) : (
                        <Sun className="w-3.5 h-3.5 text-[#f59e0b]" />
                      )}
                    </div>

                    {isSelected ? (
                      <span 
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs shadow"
                        style={{ backgroundColor: t.colors.accentPrimary }}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 transition" style={{ color: t.colors.textMuted }}>
                        اضغط للتفعيل
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs mb-4 leading-relaxed" style={{ color: t.colors.textSecondary }}>
                    {t.description}
                  </p>

                  {/* Mini Preview Palettes Bar */}
                  <div 
                    className="p-2.5 rounded-xl border flex items-center justify-between"
                    style={{
                      backgroundColor: t.colors.bgPage,
                      borderColor: t.colors.borderColor
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-4 h-4 rounded-full border shadow-xs" 
                        style={{ backgroundColor: t.colors.bgSurface, borderColor: t.colors.borderColor }} 
                        title="خلفية البطاقات" 
                      />
                      <div 
                        className="w-4 h-4 rounded-full border shadow-xs" 
                        style={{ backgroundColor: t.colors.chatBubbleBot, borderColor: t.colors.borderColor }} 
                        title="رسائل تلجرام" 
                      />
                      <div 
                        className="w-4 h-4 rounded-full shadow-xs" 
                        style={{ backgroundColor: t.colors.accentPrimary }} 
                        title="اللون المميز" 
                      />
                    </div>

                    <span 
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: t.colors.accentSubtle,
                        color: t.colors.accentPrimary
                      }}
                    >
                      {t.isDark ? 'داكن 🌙' : 'فاتح ☀️'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Notice */}
          <div 
            className="p-3.5 rounded-xl border flex items-center gap-2.5 text-xs transition-colors"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor,
              color: theme.colors.textSecondary
            }}
          >
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: theme.colors.accentPrimary }} />
            <span>
              يتم حفظ ثيمك المفضل تلقائياً في المتصفح وسيبقى فعالاً في جميع الزيارات القادمة.
            </span>
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
            الثيم الحالي: <strong style={{ color: theme.colors.accentPrimary }}>{theme.name}</strong>
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
            style={{
              backgroundColor: theme.colors.accentPrimary,
              color: theme.isDark ? '#ffffff' : '#ffffff'
            }}
          >
            تم واكتمال
          </button>
        </div>
      </div>
    </div>
  );
};
