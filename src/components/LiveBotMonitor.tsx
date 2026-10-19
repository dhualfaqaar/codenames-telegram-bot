import React, { useState, useEffect } from 'react';
import { Radio, Users, RefreshCw, Send, CheckCircle, Clock, ExternalLink, ShieldAlert, Award, BarChart3, Gamepad2 } from 'lucide-react';
import { BotConfig, CodenamesGame } from '../types/codenames';
import { useTheme } from '../context/ThemeContext';
import { FinishedGamesStats } from './FinishedGamesStats';

interface LiveBotMonitorProps {
  botConfig: BotConfig;
  onOpenSettings: () => void;
}

export const LiveBotMonitor: React.FC<LiveBotMonitorProps> = ({ botConfig, onOpenSettings }) => {
  const { theme } = useTheme();
  const [subView, setSubView] = useState<'live' | 'stats'>('live');
  const [games, setGames] = useState<CodenamesGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/games');
      const data = await res.json();
      if (data.success && Array.isArray(data.games)) {
        setGames(data.games);
        if (data.games.length > 0 && !selectedChatId) {
          setSelectedChatId(data.games[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch games', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = botConfig.isActive && botConfig.botInfo;
  const selectedGame = games.find(g => g.id === selectedChatId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Status Bar */}
      <div 
        className="p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isOnline ? 'bg-[#18392b] text-[#00c853]' : 'bg-[#3b1718] text-[#ef5350]'
          }`}>
            <Radio className={`w-6 h-6 ${isOnline ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
                مراقبة الجولات والمجموعات الحية في تلجرام
              </h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isOnline ? 'bg-[#18392b] text-[#00c853] border-[#00c853]/40' : 'bg-[#3b1718] text-[#ef5350] border-[#ef5350]/40'
              }`}>
                {isOnline ? 'البوت متصل بالسيرفر' : 'البوت غير مفعل'}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
              {isOnline 
                ? `البوت متصل بالمعرف @${botConfig.botInfo?.username} ويستقبل الأوامر من الكروبات تلقائياً`
                : 'قم بربط Bot Token لتشغيل البوت في أي كروب تلجرام حقيقي'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchGames}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor,
              color: theme.colors.textPrimary
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث القائمة</span>
          </button>

          {!isOnline && (
            <button
              onClick={onOpenSettings}
              className="px-4 py-2 rounded-xl bg-[#00c853] hover:bg-[#00b047] text-black text-xs font-bold transition shadow"
            >
              توصيل البوت الآن
            </button>
          )}

          {isOnline && botConfig.botInfo?.username && (
            <a
              href={`https://t.me/${botConfig.botInfo.username}?startgroup=codenames`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
              style={{ backgroundColor: theme.colors.accentPrimary }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>إضافة البوت لكروب تلجرام</span>
            </a>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs: Live Rooms vs Finished Games Stats */}
      <div 
        className="flex items-center gap-2 p-1.5 rounded-2xl border transition-colors"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <button
          onClick={() => setSubView('live')}
          className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
          style={{
            backgroundColor: subView === 'live' ? theme.colors.accentPrimary : 'transparent',
            color: subView === 'live' ? '#ffffff' : theme.colors.textSecondary
          }}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>المجموعات الحية النشطة حالياً</span>
          {games.length > 0 && (
            <span 
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
              style={{
                backgroundColor: subView === 'live' ? 'rgba(0,0,0,0.25)' : theme.colors.bgInput,
                color: subView === 'live' ? '#ffffff' : theme.colors.accentPrimary
              }}
            >
              {games.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubView('stats')}
          className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
          style={{
            backgroundColor: subView === 'stats' ? theme.colors.accentPrimary : 'transparent',
            color: subView === 'stats' ? '#ffffff' : theme.colors.textSecondary
          }}
        >
          <BarChart3 className="w-4 h-4" />
          <span>إحصائيات الألعاب المنتهية والمخططات البيانية 📊</span>
        </button>
      </div>

      {/* View Switch: Finished Stats OR Live Games */}
      {subView === 'stats' ? (
        <FinishedGamesStats />
      ) : (
        /* Live Games View */
        games.length === 0 ? (
          <div 
            className="border rounded-2xl p-8 text-center space-y-4 transition-colors"
            style={{
              backgroundColor: theme.colors.bgSurface,
              borderColor: theme.colors.borderColor
            }}
          >
            <div 
              className="w-16 h-16 rounded-3xl border flex items-center justify-center mx-auto"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor,
                color: theme.colors.accentPrimary
              }}
            >
              <Users className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
                لا توجد جولات نشطة حالياً في تلجرام
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: theme.colors.textSecondary }}>
                عندما يكتب أي شخص <code className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: theme.colors.bgInput, color: theme.colors.accentPrimary }}>/newgame</code> داخل أي مجموعة في تلجرام، ستظهر الغرفة وتفاصيلها هنا مباشرة بالوقت الفعلي.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setSubView('stats')}
                className="px-4 py-2 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5"
                style={{ backgroundColor: theme.colors.accentPrimary }}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>عرض إحصائيات المباريات المنتهية 📊</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Rooms List */}
            <div className="lg:col-span-4 space-y-3">
              <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
                <Users className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
                <span>المجموعات النشطة ({games.length}):</span>
              </h3>

              <div className="space-y-2">
                {games.map(g => {
                  const isSelected = g.id === selectedChatId;
                  const blueLeft = g.cards.filter(c => c.type === 'blue' && !c.revealed).length;
                  const redLeft = g.cards.filter(c => c.type === 'red' && !c.revealed).length;

                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedChatId(g.id)}
                      className={`w-full p-4 rounded-xl border text-right transition ${
                        isSelected ? 'ring-2 shadow-md' : 'hover:opacity-90'
                      }`}
                      style={{
                        backgroundColor: isSelected ? theme.colors.bgElevated : theme.colors.bgSurface,
                        borderColor: isSelected ? theme.colors.accentPrimary : theme.colors.borderColor
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs truncate max-w-[160px]" style={{ color: theme.colors.textPrimary }}>
                          {g.chatTitle || `مجموعة #${g.id.slice(-4)}`}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          g.status === 'game_over'
                            ? 'bg-[#2b5278] text-[#90caf9]'
                            : g.status === 'lobby'
                            ? 'bg-[#37474f] text-[#cfd8dc]'
                            : 'bg-[#18392b] text-[#00c853]'
                        }`}>
                          {g.status === 'lobby' ? 'قاعة الانتظار' : g.status === 'game_over' ? 'انتهت' : 'قيد اللعب'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]" style={{ color: theme.colors.textMuted }}>
                        <span>اللاعبون: {g.players.length}</span>
                        {g.cards.length === 25 && (
                          <span>🔵 {blueLeft} | 🔴 {redLeft}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Room Details View */}
            <div className="lg:col-span-8">
              {selectedGame ? (
                <div 
                  className="border rounded-2xl p-6 space-y-6 transition-colors"
                  style={{
                    backgroundColor: theme.colors.bgSurface,
                    borderColor: theme.colors.borderColor
                  }}
                >
                  <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: theme.colors.borderColor }}>
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
                        <span>{selectedGame.chatTitle || 'المجموعة'}</span>
                        <span className="text-xs font-mono" style={{ color: theme.colors.textMuted }}>(ID: {selectedGame.id})</span>
                      </h3>
                      <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        الحالة: {selectedGame.status === 'lobby' ? 'قاعة الانتظار لاختيار الفرق' : selectedGame.status === 'game_over' ? 'انتهت الجولة' : `دور الفريق ${selectedGame.currentTurn === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'}`}
                      </p>
                    </div>

                    {selectedGame.currentClue && (
                      <div 
                        className="border px-3 py-1.5 rounded-xl text-xs"
                        style={{
                          backgroundColor: theme.colors.bgInput,
                          borderColor: theme.colors.borderColor
                        }}
                      >
                        <span style={{ color: theme.colors.textMuted }}>التلميح الحالي: </span>
                        <span className="font-bold" style={{ color: theme.colors.accentPrimary }}>"{selectedGame.currentClue.word}"</span>
                        <span className="text-[#00c853] mr-1">({selectedGame.currentClue.count})</span>
                      </div>
                    )}
                  </div>

                  {/* 5x5 Board Overview */}
                  {selectedGame.cards.length === 25 ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>لوحة الـ 25 بطاقة:</h4>
                      <div 
                        className="grid grid-cols-5 gap-1.5 p-3 rounded-xl border"
                        style={{
                          backgroundColor: theme.colors.bgInput,
                          borderColor: theme.colors.borderColor
                        }}
                      >
                        {selectedGame.cards.map(card => {
                          let bg = theme.colors.chatCardDefault;
                          let text = theme.colors.chatCardDefaultText;
                          if (card.revealed) {
                            if (card.type === 'blue') { bg = '#1565c0'; text = '#ffffff'; }
                            else if (card.type === 'red') { bg = '#c62828'; text = '#ffffff'; }
                            else if (card.type === 'assassin') { bg = '#000000'; text = '#ff5252'; }
                            else { bg = '#607d8b'; text = '#ffffff'; }
                          }
                          return (
                            <div
                              key={card.id}
                              className="h-11 rounded-lg p-1 text-[11px] font-bold flex items-center justify-center text-center truncate shadow-xs"
                              style={{
                                backgroundColor: bg,
                                color: text
                              }}
                            >
                              {card.revealed && (card.type === 'blue' ? '🔵 ' : card.type === 'red' ? '🔴 ' : card.type === 'assassin' ? '💣 ' : '⚪ ')}
                              {card.word}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="p-4 rounded-xl text-xs text-center"
                      style={{
                        backgroundColor: theme.colors.bgInput,
                        color: theme.colors.textMuted
                      }}
                    >
                      اللعبة ما زالت في قاعة الانتظار. سيتم توزيع الـ 25 بطاقة عند الضغط على (ابدأ اللعبة 🚀) في المجموعة.
                    </div>
                  )}

                  {/* Players by Team */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                      className="p-4 rounded-xl border space-y-2"
                      style={{
                        backgroundColor: theme.colors.bgInput,
                        borderColor: theme.isDark ? '#2b5278' : '#bbdefb'
                      }}
                    >
                      <div className="text-xs font-bold text-[#2481cc] flex items-center gap-1.5">
                        <span>🔵 الفريق الأزرق</span>
                      </div>
                      <ul className="text-xs space-y-1" style={{ color: theme.colors.textSecondary }}>
                        {selectedGame.players.filter(p => p.team === 'blue').map(p => (
                          <li key={p.id} className="flex justify-between">
                            <span>{p.name}</span>
                            <span className="text-[11px]" style={{ color: theme.colors.textMuted }}>{p.role === 'spymaster' ? 'جاسوس 🕵️' : 'عميل 👤'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div 
                      className="p-4 rounded-xl border space-y-2"
                      style={{
                        backgroundColor: theme.colors.bgInput,
                        borderColor: theme.isDark ? '#7f2628' : '#ffcdd2'
                      }}
                    >
                      <div className="text-xs font-bold text-[#ef5350] flex items-center gap-1.5">
                        <span>🔴 الفريق الأحمر</span>
                      </div>
                      <ul className="text-xs space-y-1" style={{ color: theme.colors.textSecondary }}>
                        {selectedGame.players.filter(p => p.team === 'red').map(p => (
                          <li key={p.id} className="flex justify-between">
                            <span>{p.name}</span>
                            <span className="text-[11px]" style={{ color: theme.colors.textMuted }}>{p.role === 'spymaster' ? 'جاسوس 🕵️' : 'عميل 👤'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Activity Logs */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>سجل أحداث الجولة:</h4>
                    <div 
                      className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-xl border text-xs font-mono"
                      style={{
                        backgroundColor: theme.colors.bgInput,
                        borderColor: theme.colors.borderColor,
                        color: theme.colors.textSecondary
                      }}
                    >
                      {selectedGame.logs.slice().reverse().map(l => (
                        <div key={l.id} className="py-0.5 border-b border-opacity-30 last:border-0" style={{ borderColor: theme.colors.borderColor }}>
                          <span className="ml-2 opacity-60">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                          <span>{l.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )
      )}
    </div>
  );
};
