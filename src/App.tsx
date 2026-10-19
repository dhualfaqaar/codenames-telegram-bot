/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TelegramChatSimulator } from './components/TelegramChatSimulator';
import { LiveBotMonitor } from './components/LiveBotMonitor';
import { WordPacksManager } from './components/WordPacksManager';
import { RulesGuide } from './components/RulesGuide';
import { BotSetupModal } from './components/BotSetupModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { BotConfig } from './types/codenames';
import { ThemeProvider, useTheme } from './context/ThemeContext';

function AppContent() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'simulator' | 'live' | 'words' | 'help'>('simulator');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  const [botConfig, setBotConfig] = useState<BotConfig>({
    token: '',
    isActive: false,
    mode: 'polling',
    activeRoomsCount: 0
  });

  // Fetch bot status from server
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const data = await res.json();
        setBotConfig(prev => ({
          ...prev,
          token: prev.token,
          hasToken: data.hasToken,
          tokenPreview: data.tokenPreview,
          isActive: data.isActive,
          mode: data.mode || 'polling',
          webhookUrl: data.webhookUrl,
          botInfo: data.botInfo,
          activeRoomsCount: data.activeGamesCount || 0,
          lastError: data.lastError,
          lastPollTime: data.lastPollTime
        }));
      }
    } catch (e) {
      console.error('Failed to fetch bot status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update token or control polling
  const handleUpdateToken = async (token: string, action: 'save' | 'test' | 'start' | 'stop') => {
    const res = await fetch('/api/bot/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action })
    });
    const data = await res.json();
    await fetchStatus();
    return data;
  };

  return (
    <div 
      className="min-h-screen flex flex-col transition-colors selection:bg-[#2481cc] selection:text-white"
      style={{
        backgroundColor: theme.colors.bgPage,
        color: theme.colors.textPrimary
      }}
    >
      {/* App Header */}
      <Header
        botConfig={botConfig}
        onOpenSettings={() => setIsSetupOpen(true)}
        onOpenHelp={() => setActiveTab('help')}
        onOpenTheme={() => setIsThemeOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content View */}
      <main className="flex-1">
        {activeTab === 'simulator' && (
          <TelegramChatSimulator onOpenSettings={() => setIsSetupOpen(true)} />
        )}

        {activeTab === 'live' && (
          <LiveBotMonitor
            botConfig={botConfig}
            onOpenSettings={() => setIsSetupOpen(true)}
          />
        )}

        {activeTab === 'words' && (
          <WordPacksManager />
        )}

        {activeTab === 'help' && (
          <RulesGuide />
        )}
      </main>

      {/* Bot Token Setup Modal */}
      <BotSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        botConfig={botConfig}
        onUpdateToken={handleUpdateToken}
      />

      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeOpen}
        onClose={() => setIsThemeOpen(false)}
      />

      {/* Footer */}
      <footer 
        className="border-t py-4 text-center text-xs transition-colors"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor,
          color: theme.colors.textMuted
        }}
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            بوت لعبة كود نيمز (Codenames) لتلجرام • تلعب بالكامل داخل مجموعات ومحادثات Telegram بأزرار تفاعلية
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsThemeOpen(true)}
              className="font-semibold transition hover:opacity-80"
              style={{ color: theme.colors.accentPrimary }}
            >
              تغيير الثيم ({theme.name.split(' ')[0]}) 🎨
            </button>
            <button
              onClick={() => setIsSetupOpen(true)}
              className="font-semibold transition hover:opacity-80"
              style={{ color: theme.colors.accentPrimary }}
            >
              إعداد التوكن والربط ⚙️
            </button>
            <button
              onClick={() => setActiveTab('help')}
              className="font-semibold transition hover:opacity-80"
              style={{ color: theme.colors.accentPrimary }}
            >
              شرح القوانين والأوامر 📜
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
