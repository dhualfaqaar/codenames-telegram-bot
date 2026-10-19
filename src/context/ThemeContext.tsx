import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeId, ThemeDefinition } from '../types/theme';

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  'telegram-dark': {
    id: 'telegram-dark',
    name: 'داكن تلجرام (الافتراضي)',
    nameEn: 'Telegram Dark',
    description: 'الألوان الليلية الكلاسيكية المعتمدة في تطبيق تلجرام الرسمي لراحة العينين.',
    isDark: true,
    colors: {
      previewBg: '#0e1621',
      previewCard: '#17212b',
      previewAccent: '#5288c1',
      bgPage: '#0e1621',
      bgSurface: '#17212b',
      bgElevated: '#1e2c3a',
      bgInput: '#0e1621',
      borderColor: '#242f3d',
      borderHover: '#2b5278',
      textPrimary: '#e4ecf2',
      textSecondary: '#a0b0c0',
      textMuted: '#7f91a4',
      accentPrimary: '#5288c1',
      accentHover: '#64b5f6',
      accentSubtle: 'rgba(43, 82, 120, 0.25)',
      chatBg: '#0e1621',
      chatBubbleBot: '#182533',
      chatBubbleBotBorder: '#2b5278',
      chatBubbleBotText: '#e4ecf2',
      chatBubbleUser: '#2b5278',
      chatBubbleUserText: '#ffffff',
      chatCardDefault: '#242f3d',
      chatCardDefaultText: '#e4ecf2',
      chatCardDefaultBorder: '#2f3d4f',
    }
  },
  'telegram-light': {
    id: 'telegram-light',
    name: 'فاتح نقي (Daylight)',
    nameEn: 'Telegram Light',
    description: 'واجهة نهارية مشرقة وواضحة جداً مطابقة لواجهة تلجرام النهارية البيضاء.',
    isDark: false,
    colors: {
      previewBg: '#f0f2f5',
      previewCard: '#ffffff',
      previewAccent: '#2481cc',
      bgPage: '#f0f2f5',
      bgSurface: '#ffffff',
      bgElevated: '#ffffff',
      bgInput: '#f4f6f8',
      borderColor: '#e1e4e8',
      borderHover: '#2481cc',
      textPrimary: '#1c242b',
      textSecondary: '#4a5763',
      textMuted: '#707e8a',
      accentPrimary: '#2481cc',
      accentHover: '#1d6fad',
      accentSubtle: 'rgba(36, 129, 204, 0.12)',
      chatBg: '#dce5ed',
      chatBubbleBot: '#ffffff',
      chatBubbleBotBorder: '#d0d7de',
      chatBubbleBotText: '#1c242b',
      chatBubbleUser: '#e1ffc7',
      chatBubbleUserText: '#102e12',
      chatCardDefault: '#f0f3f6',
      chatCardDefaultText: '#1c242b',
      chatCardDefaultBorder: '#d5dae0',
    }
  },
  'midnight-amoled': {
    id: 'midnight-amoled',
    name: 'أسود مطلق (AMOLED)',
    nameEn: 'Midnight AMOLED',
    description: 'خلفية سوداء نقية 100% موفرة للطاقة وتباين عالي مع لمسات نيون.',
    isDark: true,
    colors: {
      previewBg: '#000000',
      previewCard: '#0f0f0f',
      previewAccent: '#00c853',
      bgPage: '#000000',
      bgSurface: '#0d0d0d',
      bgElevated: '#171717',
      bgInput: '#000000',
      borderColor: '#262626',
      borderHover: '#404040',
      textPrimary: '#ffffff',
      textSecondary: '#a3a3a3',
      textMuted: '#737373',
      accentPrimary: '#00c853',
      accentHover: '#00e676',
      accentSubtle: 'rgba(0, 200, 83, 0.15)',
      chatBg: '#000000',
      chatBubbleBot: '#141414',
      chatBubbleBotBorder: '#262626',
      chatBubbleBotText: '#ffffff',
      chatBubbleUser: '#1b3820',
      chatBubbleUserText: '#69f0ae',
      chatCardDefault: '#171717',
      chatCardDefaultText: '#ffffff',
      chatCardDefaultBorder: '#2e2e2e',
    }
  },
  'emerald': {
    id: 'emerald',
    name: 'أخضر زمردي هادئ',
    nameEn: 'Emerald Forest',
    description: 'درجات الطبيعة الخضراء الهادئة والمستوحاة من ألوان الغابات والتلجرام.',
    isDark: true,
    colors: {
      previewBg: '#08140f',
      previewCard: '#0e221b',
      previewAccent: '#10b981',
      bgPage: '#08140f',
      bgSurface: '#0e221b',
      bgElevated: '#153328',
      bgInput: '#08140f',
      borderColor: '#1b4234',
      borderHover: '#2d6a54',
      textPrimary: '#e8f5e9',
      textSecondary: '#a5d6a7',
      textMuted: '#81c784',
      accentPrimary: '#10b981',
      accentHover: '#34d399',
      accentSubtle: 'rgba(16, 185, 129, 0.2)',
      chatBg: '#08140f',
      chatBubbleBot: '#122b22',
      chatBubbleBotBorder: '#1b4234',
      chatBubbleBotText: '#e8f5e9',
      chatBubbleUser: '#1b5e20',
      chatBubbleUserText: '#ffffff',
      chatCardDefault: '#17362a',
      chatCardDefaultText: '#e8f5e9',
      chatCardDefaultBorder: '#22503e',
    }
  },
  'sunset-amber': {
    id: 'sunset-amber',
    name: 'عنبري دافئ (Sunset)',
    nameEn: 'Warm Amber',
    description: 'درجات القهوة والغروب الدافئة التي تقلل الإجهاد البصري في المساء.',
    isDark: true,
    colors: {
      previewBg: '#130e0b',
      previewCard: '#1f1813',
      previewAccent: '#f59e0b',
      bgPage: '#130e0b',
      bgSurface: '#1f1813',
      bgElevated: '#2c221c',
      bgInput: '#130e0b',
      borderColor: '#3d2e26',
      borderHover: '#664c3d',
      textPrimary: '#fef3c7',
      textSecondary: '#fde68a',
      textMuted: '#d97706',
      accentPrimary: '#f59e0b',
      accentHover: '#fbbf24',
      accentSubtle: 'rgba(245, 158, 11, 0.2)',
      chatBg: '#130e0b',
      chatBubbleBot: '#241b15',
      chatBubbleBotBorder: '#3d2e26',
      chatBubbleBotText: '#fef3c7',
      chatBubbleUser: '#78350f',
      chatBubbleUserText: '#fffbeb',
      chatCardDefault: '#291f19',
      chatCardDefaultText: '#fef3c7',
      chatCardDefaultBorder: '#4a382e',
    }
  },
  'royal-violet': {
    id: 'royal-violet',
    name: 'بنفسجي ملكي (Royal)',
    nameEn: 'Royal Violet',
    description: 'طابع حديث وفخم بلمسات بنفسجية أرجوانية أنيقة وجذابة.',
    isDark: true,
    colors: {
      previewBg: '#100b1a',
      previewCard: '#181126',
      previewAccent: '#a855f7',
      bgPage: '#100b1a',
      bgSurface: '#181126',
      bgElevated: '#241938',
      bgInput: '#100b1a',
      borderColor: '#372654',
      borderHover: '#583e84',
      textPrimary: '#f3e8ff',
      textSecondary: '#d8b4fe',
      textMuted: '#c084fc',
      accentPrimary: '#a855f7',
      accentHover: '#c084fc',
      accentSubtle: 'rgba(168, 85, 247, 0.2)',
      chatBg: '#100b1a',
      chatBubbleBot: '#1e1530',
      chatBubbleBotBorder: '#372654',
      chatBubbleBotText: '#f3e8ff',
      chatBubbleUser: '#581c87',
      chatBubbleUserText: '#ffffff',
      chatCardDefault: '#261b3d',
      chatCardDefaultText: '#f3e8ff',
      chatCardDefaultBorder: '#463268',
    }
  }
};

interface ThemeContextType {
  currentThemeId: ThemeId;
  theme: ThemeDefinition;
  setThemeId: (id: ThemeId) => void;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem('codenames_theme') as ThemeId;
      if (saved && THEMES[saved]) return saved;
    } catch (e) {
      // ignore
    }
    return 'telegram-dark';
  });

  const theme = THEMES[currentThemeId] || THEMES['telegram-dark'];

  useEffect(() => {
    try {
      localStorage.setItem('codenames_theme', currentThemeId);
    } catch (e) {
      // ignore
    }

    // Apply CSS variables to root
    const root = document.documentElement;
    const colors = theme.colors;

    root.style.setProperty('--bg-page', colors.bgPage);
    root.style.setProperty('--bg-surface', colors.bgSurface);
    root.style.setProperty('--bg-elevated', colors.bgElevated);
    root.style.setProperty('--bg-input', colors.bgInput);
    root.style.setProperty('--border-color', colors.borderColor);
    root.style.setProperty('--border-hover', colors.borderHover);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--accent-primary', colors.accentPrimary);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--accent-subtle', colors.accentSubtle);
    root.style.setProperty('--chat-bg', colors.chatBg);
    root.style.setProperty('--chat-bubble-bot', colors.chatBubbleBot);
    root.style.setProperty('--chat-bubble-bot-border', colors.chatBubbleBotBorder);
    root.style.setProperty('--chat-bubble-bot-text', colors.chatBubbleBotText);
    root.style.setProperty('--chat-bubble-user', colors.chatBubbleUser);
    root.style.setProperty('--chat-bubble-user-text', colors.chatBubbleUserText);
    root.style.setProperty('--chat-card-default', colors.chatCardDefault);
    root.style.setProperty('--chat-card-default-text', colors.chatCardDefaultText);
    root.style.setProperty('--chat-card-default-border', colors.chatCardDefaultBorder);

    // Apply color-scheme attribute
    root.setAttribute('data-theme', currentThemeId);
    root.style.colorScheme = theme.isDark ? 'dark' : 'light';
    document.body.style.backgroundColor = colors.bgPage;
    document.body.style.color = colors.textPrimary;
  }, [currentThemeId, theme]);

  return (
    <ThemeContext.Provider
      value={{
        currentThemeId,
        theme,
        setThemeId: setCurrentThemeId,
        availableThemes: Object.values(THEMES),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
