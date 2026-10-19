export type ThemeId = 
  | 'telegram-dark' 
  | 'telegram-light' 
  | 'midnight-amoled' 
  | 'emerald' 
  | 'sunset-amber'
  | 'royal-violet';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  nameEn: string;
  description: string;
  isDark: boolean;
  colors: {
    previewBg: string;
    previewCard: string;
    previewAccent: string;
    bgPage: string;
    bgSurface: string;
    bgElevated: string;
    bgInput: string;
    borderColor: string;
    borderHover: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accentPrimary: string;
    accentHover: string;
    accentSubtle: string;
    chatBg: string;
    chatBubbleBot: string;
    chatBubbleBotBorder: string;
    chatBubbleBotText: string;
    chatBubbleUser: string;
    chatBubbleUserText: string;
    chatCardDefault: string;
    chatCardDefaultText: string;
    chatCardDefaultBorder: string;
  };
}
