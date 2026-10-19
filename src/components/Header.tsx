import React from 'react';
import { Bot, Send, Shield, Sparkles, Settings, HelpCircle, CheckCircle2, AlertCircle, Palette, Sun, Moon } from 'lucide-react';
import { BotConfig } from '../types/codenames';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  botConfig: BotConfig;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenTheme: () => void;
  activeTab: 'simulator' | 'live' | 'words' | 'help';
  setActiveTab: (tab: 'simulator' | 'live' | 'words' | 'help') => void;
}

export const Header: React.FC<HeaderProps> = ({
  botConfig,
  onOpenSettings,
  onOpenHelp,
  onOpenTheme,
  activeTab,
  setActiveTab,
}) => {
  const { theme } = useTheme();
  const isOnline = botConfig.isActive && botConfig.botInfo;

  return (
    <header 
      className="sticky top-0 z-40 shadow-sm border-b transition-colors"
      style={{
        backgroundColor: theme.colors.bgSurface,
        borderColor: theme.colors.borderColor
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors"
              style={{
                backgroundColor: theme.colors.accentPrimary,
                color: '#ffffff'
              }}
            >
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-wide" style={{ color: theme.colors.textPrimary }}>
                  بوت كود نيمز تلجرام
                </h1>
                <span 
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors"
                  style={{
                    backgroundColor: theme.colors.accentSubtle,
                    color: theme.colors.accentPrimary,
                    borderColor: theme.colors.borderColor
                  }}
                >
                  Codenames Bot
                </span>
              </div>
              <p className="text-xs hidden sm:block" style={{ color: theme.colors.textMuted }}>
                العب مباشرة داخل محادثات ومجموعات تلجرام بأزرار تفاعلية وخريطة سرية
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav 
            className="flex items-center gap-1 p-1 rounded-xl border transition-colors"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor
            }}
          >
            <button
              onClick={() => setActiveTab('simulator')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: activeTab === 'simulator' ? theme.colors.accentPrimary : 'transparent',
                color: activeTab === 'simulator' ? '#ffffff' : theme.colors.textSecondary
              }}
            >
              محاكي محادثة تلجرام 💬
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              style={{
                backgroundColor: activeTab === 'live' ? theme.colors.accentPrimary : 'transparent',
                color: activeTab === 'live' ? '#ffffff' : theme.colors.textSecondary
              }}
            >
              <span>المجموعات النشطة</span>
              {botConfig.activeRoomsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#00c853] text-black text-[10px] flex items-center justify-center font-bold">
                  {botConfig.activeRoomsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('words')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: activeTab === 'words' ? theme.colors.accentPrimary : 'transparent',
                color: activeTab === 'words' ? '#ffffff' : theme.colors.textSecondary
              }}
            >
              حزم الكلمات 📚
            </button>
            <button
              onClick={() => setActiveTab('help')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: activeTab === 'help' ? theme.colors.accentPrimary : 'transparent',
                color: activeTab === 'help' ? '#ffffff' : theme.colors.textSecondary
              }}
            >
              القوانين والأوامر 📜
            </button>
          </nav>

          {/* Theme, Bot Status & Settings Trigger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Bot Link if online */}
            {isOnline && botConfig.botInfo?.username && (
              <a
                href={`https://t.me/${botConfig.botInfo.username}?startgroup=codenames`}
                target="_blank"
                rel="noreferrer"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition"
                style={{
                  backgroundColor: theme.colors.accentSubtle,
                  borderColor: theme.colors.borderColor,
                  color: theme.colors.accentPrimary
                }}
              >
                <Send className="w-3.5 h-3.5 rotate-[-45deg]" />
                <span>@{botConfig.botInfo.username}</span>
              </a>
            )}

            {/* Theme Selector Button */}
            <button
              onClick={onOpenTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-xs"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor,
                color: theme.colors.textPrimary
              }}
              title="تغيير ثيم ومظهر واجهة البوت"
            >
              <Palette className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
              <span className="hidden sm:inline">{theme.name.split(' ')[0]}</span>
              {theme.isDark ? (
                <Moon className="w-3 h-3 opacity-60 hidden md:inline" />
              ) : (
                <Sun className="w-3 h-3 text-[#f59e0b] hidden md:inline" />
              )}
            </button>

            {/* Connection Status Badge */}
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor,
                color: theme.colors.textPrimary
              }}
              title="إعدادات توكن البوت والاتصال"
            >
              <div className="relative flex items-center justify-center">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-[#00c853]' : 'bg-[#e53935]'
                  }`}
                />
                {isOnline && (
                  <span className="absolute w-2.5 h-2.5 rounded-full bg-[#00c853] animate-ping opacity-75" />
                )}
              </div>
              <span className="font-semibold hidden sm:inline">
                {isOnline ? 'البوت متصل' : 'توصيل البوت'}
              </span>
              <Settings className="w-4 h-4" style={{ color: theme.colors.textMuted }} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
