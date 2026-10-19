import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  TrendingUp, 
  Award, 
  Bomb, 
  Target, 
  Users, 
  RefreshCw, 
  Calendar, 
  Search, 
  ChevronRight, 
  Zap, 
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  Columns3,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  HelpCircle,
  PlusCircle
} from 'lucide-react';
import { GameStats, PlayerStat, CodenamesGame } from '../types/codenames';
import { useTheme } from '../context/ThemeContext';

export const FinishedGamesStats: React.FC = () => {
  const { theme } = useTheme();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingSample, setAddingSample] = useState(false);
  
  // Interactive chart state
  const [hoveredSlice, setHoveredSlice] = useState<'blue' | 'red' | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<'all' | 'blue' | 'red'>('all');
  const [chartMode, setChartMode] = useState<'bars' | 'columns' | 'accuracy'>('bars');
  const [sortBy, setSortBy] = useState<'guesses' | 'accuracy' | 'matches'>('guesses');
  
  const [hoveredPlayer, setHoveredPlayer] = useState<PlayerStat | null>(null);
  const [searchPlayer, setSearchPlayer] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<CodenamesGame | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/stats');
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch bot stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const addSampleMatch = async () => {
    setAddingSample(true);
    try {
      const res = await fetch('/api/bot/stats/sample', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to add sample match:', e);
    } finally {
      setAddingSample(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <div className="p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto" style={{ color: theme.colors.accentPrimary }} />
        <p className="text-xs" style={{ color: theme.colors.textMuted }}>جاري تحميل إحصائيات المباريات المنتهية...</p>
      </div>
    );
  }

  // Filter players by team & search query
  let processedPlayers = stats.playerStats.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchPlayer.toLowerCase());
    const matchesTeam = selectedTeamFilter === 'all' || p.team === selectedTeamFilter;
    return matchesSearch && matchesTeam;
  });

  // Sort players
  processedPlayers = [...processedPlayers].sort((a, b) => {
    if (sortBy === 'guesses') {
      return b.correctGuesses - a.correctGuesses;
    }
    if (sortBy === 'accuracy') {
      const accA = a.wordsGuessed > 0 ? (a.correctGuesses / a.wordsGuessed) : 0;
      const accB = b.wordsGuessed > 0 ? (b.correctGuesses / b.wordsGuessed) : 0;
      return accB - accA;
    }
    if (sortBy === 'matches') {
      return b.gamesPlayed - a.gamesPlayed;
    }
    return 0;
  });

  // Calculate highest guesses for visual scale
  const maxGuesses = Math.max(1, ...stats.playerStats.map(p => p.correctGuesses));

  // Team totals for comparison columns
  const bluePlayers = stats.playerStats.filter(p => p.team === 'blue');
  const redPlayers = stats.playerStats.filter(p => p.team === 'red');
  const blueTotalGuesses = bluePlayers.reduce((acc, p) => acc + p.correctGuesses, 0);
  const redTotalGuesses = redPlayers.reduce((acc, p) => acc + p.correctGuesses, 0);
  const maxTeamGuesses = Math.max(1, blueTotalGuesses, redTotalGuesses);

  // Donut chart angles (radius = 70, strokeWidth = 24)
  const totalWins = stats.blueWins + stats.redWins || 1;
  const blueFraction = stats.blueWins / totalWins;
  const circumference = 2 * Math.PI * 70;
  const blueDash = blueFraction * circumference;
  const redDash = circumference - blueDash;

  // Filtered recent matches based on team filter
  const filteredMatches = stats.recentMatches.filter(m => {
    if (selectedTeamFilter === 'all') return true;
    return m.winner === selectedTeamFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner, Actions & Sample Generator */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
            <BarChart3 className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
            <span>لوحة تحليلات وإحصائيات الألعاب المنتهية والمخططات التفاعلية</span>
          </h3>
          <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
            متابعة دقيقة لمعدلات فوز الفرق، ترتيب هدافي التخمين، ونسب الدقة بالوقت الفعلي
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={addSampleMatch}
            disabled={addingSample}
            className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-xs hover:opacity-90"
            style={{
              backgroundColor: theme.colors.accentSubtle,
              borderColor: theme.colors.accentPrimary,
              color: theme.colors.accentPrimary
            }}
            title="إضافة جولة تجريبية مسجلة لاختبار حركة المخططات البيانية"
          >
            <PlusCircle className={`w-3.5 h-3.5 ${addingSample ? 'animate-spin' : ''}`} />
            <span>جولة تجريبية جديدة ⚡</span>
          </button>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor,
              color: theme.colors.textPrimary
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Matches */}
        <div 
          onClick={() => setSelectedTeamFilter('all')}
          className={`p-4 rounded-2xl border space-y-1 transition-all shadow-xs cursor-pointer ${
            selectedTeamFilter === 'all' ? 'ring-2' : ''
          }`}
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: selectedTeamFilter === 'all' ? theme.colors.accentPrimary : theme.colors.borderColor
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: theme.colors.textMuted }}>إجمالي المباريات</span>
            <Trophy className="w-4 h-4 text-[#ffca28]" />
          </div>
          <div className="text-xl font-black font-mono" style={{ color: theme.colors.textPrimary }}>
            {stats.totalGamesPlayed}
          </div>
          <span className="text-[10px] text-[#00c853] block">مكتملة ومسجلة</span>
        </div>

        {/* Blue Wins */}
        <div 
          onClick={() => setSelectedTeamFilter(selectedTeamFilter === 'blue' ? 'all' : 'blue')}
          className={`p-4 rounded-2xl border space-y-1 transition-all shadow-xs cursor-pointer ${
            selectedTeamFilter === 'blue' ? 'ring-2 ring-[#2481cc]' : ''
          }`}
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: selectedTeamFilter === 'blue' ? '#2481cc' : theme.colors.borderColor
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#2481cc]">انتصارات الأزرق 🔵</span>
            <span className="text-xs font-mono font-bold text-[#2481cc]">{stats.blueWinPercentage}%</span>
          </div>
          <div className="text-xl font-black font-mono text-[#2481cc]">
            {stats.blueWins}
          </div>
          <div className="w-full bg-[#1b334c] h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-[#2481cc] h-full transition-all duration-500" style={{ width: `${stats.blueWinPercentage}%` }} />
          </div>
        </div>

        {/* Red Wins */}
        <div 
          onClick={() => setSelectedTeamFilter(selectedTeamFilter === 'red' ? 'all' : 'red')}
          className={`p-4 rounded-2xl border space-y-1 transition-all shadow-xs cursor-pointer ${
            selectedTeamFilter === 'red' ? 'ring-2 ring-[#ef5350]' : ''
          }`}
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: selectedTeamFilter === 'red' ? '#ef5350' : theme.colors.borderColor
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#ef5350]">انتصارات الأحمر 🔴</span>
            <span className="text-xs font-mono font-bold text-[#ef5350]">{stats.redWinPercentage}%</span>
          </div>
          <div className="text-xl font-black font-mono text-[#ef5350]">
            {stats.redWins}
          </div>
          <div className="w-full bg-[#441d20] h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-[#ef5350] h-full transition-all duration-500" style={{ width: `${stats.redWinPercentage}%` }} />
          </div>
        </div>

        {/* Total Guessed Words */}
        <div 
          className="p-4 rounded-2xl border space-y-1 transition-colors shadow-xs"
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: theme.colors.borderColor
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: theme.colors.textMuted }}>الكلمات المخمنة</span>
            <Target className="w-4 h-4 text-[#00c853]" />
          </div>
          <div className="text-xl font-black font-mono text-[#00c853]">
            {stats.totalWordsGuessed}
          </div>
          <span className="text-[10px]" style={{ color: theme.colors.textMuted }}>تخمينات ناجحة</span>
        </div>

        {/* Assassin Hits */}
        <div 
          className="p-4 rounded-2xl border space-y-1 transition-colors shadow-xs col-span-2 sm:col-span-1"
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: theme.colors.borderColor
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#ff5252]">تفجيرات القاتل 💣</span>
            <Bomb className="w-4 h-4 text-[#ff5252]" />
          </div>
          <div className="text-xl font-black font-mono text-[#ff5252]">
            {stats.assassinTriggers}
          </div>
          <span className="text-[10px]" style={{ color: theme.colors.textMuted }}>خسائر فورية</span>
        </div>
      </div>

      {/* Recent Matches Visual Strip / Sequence (Timeline of outcomes) */}
      {stats.recentMatches.length > 0 && (
        <div 
          className="p-3.5 rounded-2xl border shadow-xs flex items-center justify-between gap-3 overflow-x-auto transition-colors"
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: theme.colors.borderColor
          }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-3.5 h-3.5" style={{ color: theme.colors.accentPrimary }} />
            <span className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>مسار نتائج آخر الجولات:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {stats.recentMatches.slice(0, 15).map((m, idx) => {
              const isBlue = m.winner === 'blue';
              return (
                <button
                  key={m.id || idx}
                  onClick={() => setSelectedMatch(m)}
                  className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-transform hover:scale-110 shadow-xs border ${
                    isBlue ? 'bg-[#1565c0] text-white border-[#2481cc]' : 'bg-[#c62828] text-white border-[#ef5350]'
                  }`}
                  title={`${m.chatTitle} - الفائز: ${isBlue ? 'الأزرق 🔵' : 'الأحمر 🔴'}`}
                >
                  {isBlue ? '🔵' : '🔴'}
                </button>
              );
            })}
          </div>

          <span className="text-[10px] shrink-0 font-mono" style={{ color: theme.colors.textMuted }}>
            الأحدث ← الأقدم
          </span>
        </div>
      )}

      {/* Main Interactive Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Donut & Win Ratio Comparison (Left 5 Cols) */}
        <div 
          className="lg:col-span-5 border rounded-2xl p-5 space-y-5 transition-colors shadow-xs flex flex-col justify-between"
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: theme.colors.borderColor
          }}
        >
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold flex items-center gap-2 mb-1" style={{ color: theme.colors.textPrimary }}>
                <PieIcon className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
                <span>مخطط نسبة انتصارات الفرق (Team Win Rate Donut)</span>
              </h4>
              {selectedTeamFilter !== 'all' && (
                <button
                  onClick={() => setSelectedTeamFilter('all')}
                  className="text-[10px] px-2 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: theme.colors.bgInput,
                    borderColor: theme.colors.borderColor,
                    color: theme.colors.accentPrimary
                  }}
                >
                  إلغاء التصفية ✕
                </button>
              )}
            </div>
            <p className="text-[11px]" style={{ color: theme.colors.textMuted }}>
              حرك المؤشر فوق القطاع لمعاينة التفاصيل أو اضغط لتصفية الإحصائيات
            </p>
          </div>

          {/* SVG Donut Chart with Interactive Hover & Click */}
          <div className="flex flex-col items-center justify-center py-2 relative">
            <svg width="220" height="220" viewBox="0 0 200 200" className="transform -rotate-90">
              {/* Background circle track */}
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke={theme.colors.bgInput}
                strokeWidth="24"
              />

              {/* Blue Team Slice */}
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke="#2481cc"
                strokeWidth={hoveredSlice === 'blue' || selectedTeamFilter === 'blue' ? 30 : 24}
                strokeDasharray={`${blueDash} ${circumference}`}
                strokeDashoffset="0"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredSlice('blue')}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => setSelectedTeamFilter(selectedTeamFilter === 'blue' ? 'all' : 'blue')}
              />

              {/* Red Team Slice */}
              <circle
                cx="100"
                cy="100"
                r="70"
                fill="none"
                stroke="#ef5350"
                strokeWidth={hoveredSlice === 'red' || selectedTeamFilter === 'red' ? 30 : 24}
                strokeDasharray={`${redDash} ${circumference}`}
                strokeDashoffset={`-${blueDash}`}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredSlice('red')}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => setSelectedTeamFilter(selectedTeamFilter === 'red' ? 'all' : 'red')}
              />
            </svg>

            {/* Center Dynamic Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              {hoveredSlice === 'blue' || selectedTeamFilter === 'blue' ? (
                <>
                  <span className="text-xl font-black font-mono text-[#2481cc]">{stats.blueWins} فوز</span>
                  <span className="text-[11px] font-bold text-[#2481cc]">الفريق الأزرق ({stats.blueWinPercentage}%)</span>
                </>
              ) : hoveredSlice === 'red' || selectedTeamFilter === 'red' ? (
                <>
                  <span className="text-xl font-black font-mono text-[#ef5350]">{stats.redWins} فوز</span>
                  <span className="text-[11px] font-bold text-[#ef5350]">الفريق الأحمر ({stats.redWinPercentage}%)</span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black font-mono" style={{ color: theme.colors.textPrimary }}>
                    {stats.totalGamesPlayed}
                  </span>
                  <span className="text-[11px]" style={{ color: theme.colors.textMuted }}>إجمالي الجولات</span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend & Win Reason Split */}
          <div className="space-y-3 pt-2 border-t" style={{ borderColor: theme.colors.borderColor }}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div 
                onMouseEnter={() => setHoveredSlice('blue')}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => setSelectedTeamFilter(selectedTeamFilter === 'blue' ? 'all' : 'blue')}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                  selectedTeamFilter === 'blue' || hoveredSlice === 'blue' ? 'ring-2 ring-[#2481cc]' : ''
                }`}
                style={{
                  backgroundColor: theme.colors.bgInput,
                  borderColor: '#2481cc'
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#2481cc]" />
                  <span className="font-bold text-[#2481cc]">الأزرق</span>
                </div>
                <span className="font-mono font-bold" style={{ color: theme.colors.textPrimary }}>
                  {stats.blueWins} ({stats.blueWinPercentage}%)
                </span>
              </div>

              <div 
                onMouseEnter={() => setHoveredSlice('red')}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => setSelectedTeamFilter(selectedTeamFilter === 'red' ? 'all' : 'red')}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                  selectedTeamFilter === 'red' || hoveredSlice === 'red' ? 'ring-2 ring-[#ef5350]' : ''
                }`}
                style={{
                  backgroundColor: theme.colors.bgInput,
                  borderColor: '#ef5350'
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ef5350]" />
                  <span className="font-bold text-[#ef5350]">الأحمر</span>
                </div>
                <span className="font-mono font-bold" style={{ color: theme.colors.textPrimary }}>
                  {stats.redWins} ({stats.redWinPercentage}%)
                </span>
              </div>
            </div>

            {/* Win Reasons Breakdown bar */}
            <div className="p-3 rounded-xl border space-y-1.5" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
              <div className="flex items-center justify-between text-[11px]" style={{ color: theme.colors.textMuted }}>
                <span>كشف كل الكلمات ({stats.allCardsFoundWins}) 🎯</span>
                <span>لمس القاتل ({stats.assassinTriggers}) 💣</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden flex bg-black/20">
                <div 
                  className="bg-[#00c853] h-full transition-all duration-500" 
                  style={{ width: `${(stats.allCardsFoundWins / (stats.totalGamesPlayed || 1)) * 100}%` }}
                  title={`كشف كل الكلمات: ${stats.allCardsFoundWins}`}
                />
                <div 
                  className="bg-[#ef5350] h-full transition-all duration-500" 
                  style={{ width: `${(stats.assassinTriggers / (stats.totalGamesPlayed || 1)) * 100}%` }}
                  title={`تفجير القاتل: ${stats.assassinTriggers}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Interactive Player Guesses Multi-mode Chart (Right 7 Cols) */}
        <div 
          className="lg:col-span-7 border rounded-2xl p-5 space-y-4 transition-colors shadow-xs flex flex-col justify-between"
          style={{
            backgroundColor: theme.colors.bgSurface,
            borderColor: theme.colors.borderColor
          }}
        >
          {/* Header Controls: Mode Selector & Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
                  <Target className="w-4 h-4 text-[#00c853]" />
                  <span>المخطط البياني التفاعلي: الكلمات التي خمنها كل لاعب</span>
                </h4>
                <p className="text-[11px] mt-0.5" style={{ color: theme.colors.textMuted }}>
                  ترتيب اللاعبين حسب عدد الكلمات الصحيحة والمقارنة بين الفريقين
                </p>
              </div>

              {/* Chart Mode Switcher Pills */}
              <div className="flex items-center gap-1 p-1 rounded-xl border self-start sm:self-auto" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
                <button
                  onClick={() => setChartMode('bars')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                  style={{
                    backgroundColor: chartMode === 'bars' ? theme.colors.accentPrimary : 'transparent',
                    color: chartMode === 'bars' ? '#ffffff' : theme.colors.textSecondary
                  }}
                  title="مخطط الأشرطة التنازلية"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>أشرطة</span>
                </button>
                <button
                  onClick={() => setChartMode('columns')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                  style={{
                    backgroundColor: chartMode === 'columns' ? theme.colors.accentPrimary : 'transparent',
                    color: chartMode === 'columns' ? '#ffffff' : theme.colors.textSecondary
                  }}
                  title="مقارنة الفريقين الرأسية"
                >
                  <Columns3 className="w-3 h-3" />
                  <span>فريقين</span>
                </button>
                <button
                  onClick={() => setChartMode('accuracy')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                  style={{
                    backgroundColor: chartMode === 'accuracy' ? theme.colors.accentPrimary : 'transparent',
                    color: chartMode === 'accuracy' ? '#ffffff' : theme.colors.textSecondary
                  }}
                  title="مصفوفة الدقة والتخمينات"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>الدقة</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: theme.colors.borderColor }}>
              {/* Team Filter Pills */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedTeamFilter('all')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition"
                  style={{
                    backgroundColor: selectedTeamFilter === 'all' ? theme.colors.accentPrimary : theme.colors.bgInput,
                    borderColor: selectedTeamFilter === 'all' ? theme.colors.accentPrimary : theme.colors.borderColor,
                    color: selectedTeamFilter === 'all' ? '#ffffff' : theme.colors.textSecondary
                  }}
                >
                  الكل
                </button>
                <button
                  onClick={() => setSelectedTeamFilter('blue')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition"
                  style={{
                    backgroundColor: selectedTeamFilter === 'blue' ? '#2481cc' : theme.colors.bgInput,
                    borderColor: '#2481cc',
                    color: selectedTeamFilter === 'blue' ? '#ffffff' : '#2481cc'
                  }}
                >
                  🔵 الأزرق
                </button>
                <button
                  onClick={() => setSelectedTeamFilter('red')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition"
                  style={{
                    backgroundColor: selectedTeamFilter === 'red' ? '#ef5350' : theme.colors.bgInput,
                    borderColor: '#ef5350',
                    color: selectedTeamFilter === 'red' ? '#ffffff' : '#ef5350'
                  }}
                >
                  🔴 الأحمر
                </button>
              </div>

              {/* Sort By & Search */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg border outline-none transition"
                  style={{
                    backgroundColor: theme.colors.bgInput,
                    borderColor: theme.colors.borderColor,
                    color: theme.colors.textPrimary
                  }}
                >
                  <option value="guesses">ترتيب: الكلمات الصحيحة</option>
                  <option value="accuracy">ترتيب: نسبة الدقة</option>
                  <option value="matches">ترتيب: المباريات الملعوبة</option>
                </select>

                <div className="relative">
                  <Search className="w-3 h-3 absolute right-2.5 top-2" style={{ color: theme.colors.textMuted }} />
                  <input
                    type="text"
                    value={searchPlayer}
                    onChange={(e) => setSearchPlayer(e.target.value)}
                    placeholder="ابحث..."
                    className="pr-7 pl-2.5 py-0.5 text-[10px] rounded-lg border outline-none w-28 transition"
                    style={{
                      backgroundColor: theme.colors.bgInput,
                      borderColor: theme.colors.borderColor,
                      color: theme.colors.textPrimary
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: Horizontal Ranking Bars */}
          {chartMode === 'bars' && (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
              {processedPlayers.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: theme.colors.textMuted }}>
                  لا يوجد لاعبون مطابقون للبحث.
                </p>
              ) : (
                processedPlayers.map((player, index) => {
                  const percent = Math.round((player.correctGuesses / maxGuesses) * 100);
                  const isHovered = hoveredPlayer?.name === player.name;
                  const isBlue = player.team === 'blue';

                  let rankBadge = `${index + 1}`;
                  if (index === 0) rankBadge = '🥇';
                  else if (index === 1) rankBadge = '🥈';
                  else if (index === 2) rankBadge = '🥉';

                  return (
                    <div
                      key={player.name}
                      onMouseEnter={() => setHoveredPlayer(player)}
                      onMouseLeave={() => setHoveredPlayer(null)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered ? 'scale-[1.01]' : 'hover:opacity-95'
                      }`}
                      style={{
                        backgroundColor: isHovered ? theme.colors.bgElevated : theme.colors.bgInput,
                        borderColor: isHovered 
                          ? (isBlue ? '#2481cc' : '#ef5350')
                          : theme.colors.borderColor,
                        boxShadow: isHovered ? `0 0 0 2px ${isBlue ? '#2481cc' : '#ef5350'}` : undefined
                      }}
                    >
                      {/* Header Row: Rank, Name, Guesses count */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-center text-xs font-bold">{rankBadge}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>
                              {player.name}
                            </span>
                            <span 
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{
                                backgroundColor: isBlue ? 'rgba(36, 129, 204, 0.2)' : 'rgba(239, 83, 80, 0.2)',
                                color: isBlue ? '#2481cc' : '#ef5350'
                              }}
                            >
                              {isBlue ? 'أزرق 🔵' : 'أحمر 🔴'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="font-bold text-[#00c853]">
                            {player.correctGuesses} كلمة صحيحة
                          </span>
                          <span style={{ color: theme.colors.textMuted }}>• {player.gamesPlayed} مباراة</span>
                        </div>
                      </div>

                      {/* The Visual Bar */}
                      <div className="w-full h-3 rounded-full overflow-hidden bg-black/25 relative flex items-center">
                        <div
                          className="h-full rounded-full transition-all duration-500 shadow-sm"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: isBlue ? '#2481cc' : '#ef5350'
                          }}
                        />
                      </div>

                      {/* Hover Info Tooltip Bar */}
                      {isHovered && (
                        <div className="mt-2 pt-2 border-t flex items-center justify-between text-[11px] animate-in fade-in" style={{ borderColor: theme.colors.borderColor }}>
                          <span style={{ color: theme.colors.textMuted }}>
                            تخمينات خاطئة: <strong className="text-[#ef5350]">{player.wrongGuesses}</strong>
                          </span>
                          <span style={{ color: theme.colors.textMuted }}>
                            نسبة الدقة: <strong className="text-[#00c853]">
                              {Math.round((player.correctGuesses / (player.wordsGuessed || 1)) * 100)}%
                            </strong>
                          </span>
                          <span style={{ color: theme.colors.textMuted }}>
                            المباريات الفائزة: <strong className="text-[#ffca28]">{player.winCount}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW MODE 2: Side-by-Side Team Comparison Columns */}
          {chartMode === 'columns' && (
            <div className="space-y-4 flex-1 py-2">
              <div className="grid grid-cols-2 gap-4 text-center">
                {/* Blue Team Column */}
                <div className="p-4 rounded-xl border flex flex-col justify-between h-64" style={{ backgroundColor: theme.colors.bgInput, borderColor: '#2481cc' }}>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[#2481cc] block">🔵 الفريق الأزرق</span>
                    <span className="text-2xl font-black font-mono text-[#2481cc]">{blueTotalGuesses}</span>
                    <span className="text-[10px] block" style={{ color: theme.colors.textMuted }}>كلمة خمنها عملاء الأزرق</span>
                  </div>

                  {/* Vertical bar */}
                  <div className="w-16 mx-auto h-32 rounded-xl bg-black/20 flex flex-col justify-end p-1 overflow-hidden">
                    <div 
                      className="w-full bg-[#2481cc] rounded-lg transition-all duration-500 shadow-md flex items-center justify-center text-white text-[10px] font-mono font-bold"
                      style={{ height: `${(blueTotalGuesses / maxTeamGuesses) * 100}%` }}
                    >
                      {blueTotalGuesses}
                    </div>
                  </div>

                  <div className="text-[11px] font-mono" style={{ color: theme.colors.textMuted }}>
                    {bluePlayers.length} لاعبين مسجلين
                  </div>
                </div>

                {/* Red Team Column */}
                <div className="p-4 rounded-xl border flex flex-col justify-between h-64" style={{ backgroundColor: theme.colors.bgInput, borderColor: '#ef5350' }}>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[#ef5350] block">🔴 الفريق الأحمر</span>
                    <span className="text-2xl font-black font-mono text-[#ef5350]">{redTotalGuesses}</span>
                    <span className="text-[10px] block" style={{ color: theme.colors.textMuted }}>كلمة خمنها عملاء الأحمر</span>
                  </div>

                  {/* Vertical bar */}
                  <div className="w-16 mx-auto h-32 rounded-xl bg-black/20 flex flex-col justify-end p-1 overflow-hidden">
                    <div 
                      className="w-full bg-[#ef5350] rounded-lg transition-all duration-500 shadow-md flex items-center justify-center text-white text-[10px] font-mono font-bold"
                      style={{ height: `${(redTotalGuesses / maxTeamGuesses) * 100}%` }}
                    >
                      {redTotalGuesses}
                    </div>
                  </div>

                  <div className="text-[11px] font-mono" style={{ color: theme.colors.textMuted }}>
                    {redPlayers.length} لاعبين مسجلين
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 3: Accuracy Matrix */}
          {chartMode === 'accuracy' && (
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[360px] pr-1">
              {processedPlayers.map((p) => {
                const total = p.wordsGuessed || (p.correctGuesses + p.wrongGuesses) || 1;
                const accuracy = Math.round((p.correctGuesses / total) * 100);
                const isBlue = p.team === 'blue';

                return (
                  <div
                    key={p.name}
                    className="p-3 rounded-xl border flex items-center justify-between text-xs transition"
                    style={{
                      backgroundColor: theme.colors.bgInput,
                      borderColor: theme.colors.borderColor
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{isBlue ? '🔵' : '🔴'}</span>
                      <div>
                        <span className="font-bold block" style={{ color: theme.colors.textPrimary }}>{p.name}</span>
                        <span className="text-[10px]" style={{ color: theme.colors.textMuted }}>
                          {p.correctGuesses} صحيحة / {p.wrongGuesses} خاطئة
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-black/20 h-2 rounded-full overflow-hidden flex">
                        <div className="bg-[#00c853] h-full" style={{ width: `${accuracy}%` }} />
                        <div className="bg-[#ef5350] h-full" style={{ width: `${100 - accuracy}%` }} />
                      </div>
                      <span className="font-mono font-bold w-10 text-left text-[#00c853]">
                        {accuracy}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Chart Insight */}
          <div className="pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: theme.colors.borderColor, color: theme.colors.textMuted }}>
            <span>عدد اللاعبين المعروضين: <strong className="font-mono" style={{ color: theme.colors.textPrimary }}>{processedPlayers.length}</strong></span>
            <span>الأكثر تخميناً: <strong className="text-[#00c853]">{stats.playerStats[0]?.name || 'لا يوجد'}</strong></span>
          </div>
        </div>
      </div>

      {/* Finished Matches Archive Table / Cards */}
      <div 
        className="border rounded-2xl p-5 space-y-4 transition-colors shadow-xs"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.colors.borderColor }}>
          <h4 className="text-xs font-bold flex items-center gap-2" style={{ color: theme.colors.textPrimary }}>
            <Calendar className="w-4 h-4" style={{ color: theme.colors.accentPrimary }} />
            <span>سجل وأرشيف المباريات المنتهية مؤخراً ({filteredMatches.length})</span>
          </h4>
          <span className="text-[11px]" style={{ color: theme.colors.textMuted }}>
            مرتبة من الأحدث إلى الأقدم • انقر لمعاينة بطاقات الجولة
          </span>
        </div>

        <div className="divide-y" style={{ borderColor: theme.colors.borderColor }}>
          {filteredMatches.map((m) => {
            const isBlueWon = m.winner === 'blue';
            const winnerText = isBlueWon ? 'فوز الأزرق 🔵' : 'فوز الأحمر 🔴';
            const reasonText = m.winReason === 'assassin_triggered' 
              ? 'بسبب لمس بطاقة القاتل 💣' 
              : 'كشف جميع بطاقات الفريق 🎯';
            const revealedWords = m.cards.filter(c => c.revealed);

            return (
              <div 
                key={m.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs shrink-0"
                    style={{
                      backgroundColor: isBlueWon ? 'rgba(36, 129, 204, 0.2)' : 'rgba(239, 83, 80, 0.2)',
                      color: isBlueWon ? '#2481cc' : '#ef5350'
                    }}
                  >
                    {isBlueWon ? '🔵' : '🔴'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: theme.colors.textPrimary }}>
                        {m.chatTitle || `مجموعة #${m.id.slice(-4)}`}
                      </span>
                      <span 
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isBlueWon ? '#2481cc' : '#ef5350',
                          color: '#ffffff'
                        }}
                      >
                        {winnerText}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: theme.colors.textMuted }}>
                      {reasonText} • تم كشف {revealedWords.length} كلمة • {m.players.length} لاعبين
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className="text-[11px] font-mono opacity-65" style={{ color: theme.colors.textMuted }}>
                    {new Date(m.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => setSelectedMatch(m)}
                    className="px-3 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1 shadow-xs hover:opacity-90"
                    style={{
                      backgroundColor: theme.colors.bgInput,
                      borderColor: theme.colors.borderColor,
                      color: theme.colors.accentPrimary
                    }}
                  >
                    <span>تفاصيل الجولة</span>
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div 
            className="w-full max-w-lg border rounded-2xl p-6 space-y-4 shadow-2xl transition-colors max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: theme.colors.bgSurface,
              borderColor: theme.colors.borderColor
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.colors.borderColor }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <div>
                  <h4 className="text-sm font-bold" style={{ color: theme.colors.textPrimary }}>
                    تفاصيل الجولة: {selectedMatch.chatTitle}
                  </h4>
                  <span className="text-xs font-bold" style={{ color: selectedMatch.winner === 'blue' ? '#2481cc' : '#ef5350' }}>
                    الفائز: {selectedMatch.winner === 'blue' ? 'الفريق الأزرق 🔵' : 'الفريق الأحمر 🔴'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
                style={{ color: theme.colors.textMuted }}
              >
                ✕
              </button>
            </div>

            {/* Revealed Cards list */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>الكلمات التي تم كشفها بالجولة:</h5>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-3 rounded-xl border max-h-48 overflow-y-auto" style={{ backgroundColor: theme.colors.bgInput, borderColor: theme.colors.borderColor }}>
                {selectedMatch.cards.filter(c => c.revealed).map(c => {
                  let badge = '⚪';
                  let bg = '#546e7a';
                  if (c.type === 'blue') { badge = '🔵'; bg = '#1565c0'; }
                  if (c.type === 'red') { badge = '🔴'; bg = '#c62828'; }
                  if (c.type === 'assassin') { badge = '💣'; bg = '#000000'; }

                  return (
                    <div 
                      key={c.id} 
                      className="p-1.5 rounded-lg text-white text-[10px] font-bold text-center truncate shadow-xs"
                      style={{ backgroundColor: bg }}
                      title={`خمنها: ${c.revealedBy?.playerName || 'غير معروف'}`}
                    >
                      <span>{badge} {c.word}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Players Roster */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl border space-y-1" style={{ backgroundColor: theme.colors.bgInput, borderColor: '#2481cc' }}>
                <span className="font-bold text-[#2481cc]">🔵 لاعبو الأزرق</span>
                <ul className="space-y-0.5 text-[11px]" style={{ color: theme.colors.textSecondary }}>
                  {selectedMatch.players.filter(p => p.team === 'blue').map(p => (
                    <li key={p.id}>• {p.name} ({p.role === 'spymaster' ? 'قائد 🕵️' : 'عميل 👤'})</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl border space-y-1" style={{ backgroundColor: theme.colors.bgInput, borderColor: '#ef5350' }}>
                <span className="font-bold text-[#ef5350]">🔴 لاعبو الأحمر</span>
                <ul className="space-y-0.5 text-[11px]" style={{ color: theme.colors.textSecondary }}>
                  {selectedMatch.players.filter(p => p.team === 'red').map(p => (
                    <li key={p.id}>• {p.name} ({p.role === 'spymaster' ? 'قائد 🕵️' : 'عميل 👤'})</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => setSelectedMatch(null)}
              className="w-full py-2.5 rounded-xl text-white text-xs font-bold transition shadow-xs"
              style={{ backgroundColor: theme.colors.accentPrimary }}
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
