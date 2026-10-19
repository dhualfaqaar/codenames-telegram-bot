import React, { useState } from 'react';
import { BookOpen, Plus, Search, Tag, Check, Sparkles, Trash2 } from 'lucide-react';
import { ARABIC_STANDARD_WORDS, ARABIC_IRAQI_WORDS, POP_CULTURE_WORDS, ENGLISH_WORDS } from '../data/words';
import { useTheme } from '../context/ThemeContext';

export const WordPacksManager: React.FC = () => {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<'standard' | 'iraqi' | 'pop' | 'english' | 'custom'>('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [customWords, setCustomWords] = useState<string[]>([
    'طاولة', 'كمبيوتر', 'لوحة مفاتيح', 'سماعات', 'شاحن', 'سيارة', 'طريق', 'مصباح', 'حقيبة', 'محفظة',
    'حديقة', 'نادي', 'مقهى', 'مطعم', 'ملعب', 'مسبح', 'صالة', 'دراجة', 'مركب', 'طوق'
  ]);
  const [newWordInput, setNewWordInput] = useState('');

  let wordsList: string[] = [];
  if (selectedCategory === 'standard') wordsList = ARABIC_STANDARD_WORDS;
  else if (selectedCategory === 'iraqi') wordsList = ARABIC_IRAQI_WORDS;
  else if (selectedCategory === 'pop') wordsList = POP_CULTURE_WORDS;
  else if (selectedCategory === 'english') wordsList = ENGLISH_WORDS;
  else wordsList = customWords;

  const filteredWords = wordsList.filter(w => w.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    const word = newWordInput.trim();
    if (!word) return;
    if (customWords.includes(word)) return;
    setCustomWords([word, ...customWords]);
    setNewWordInput('');
  };

  const handleRemoveWord = (wordToRemove: string) => {
    setCustomWords(customWords.filter(w => w !== wordToRemove));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div 
        className="p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs"
            style={{
              backgroundColor: theme.colors.accentSubtle,
              color: theme.colors.accentPrimary
            }}
          >
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: theme.colors.textPrimary }}>
              مكتبة حزم الكلمات للعبة كود نيمز
            </h2>
            <p className="text-xs mt-0.5" style={{ color: theme.colors.textMuted }}>
              تصفح الكلمات العربية والعراقية والعالمية المستخدمة في توليد بطاقات اللعبة الـ 25 عشوائياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-2.5" style={{ color: theme.colors.textMuted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن كلمة..."
              className="border rounded-xl pr-9 pl-4 py-2 text-xs outline-none w-56 transition"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor,
                color: theme.colors.textPrimary
              }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedCategory('standard')}
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-xs"
          style={{
            backgroundColor: selectedCategory === 'standard' ? theme.colors.accentPrimary : theme.colors.bgSurface,
            borderColor: selectedCategory === 'standard' ? theme.colors.accentPrimary : theme.colors.borderColor,
            color: selectedCategory === 'standard' ? '#ffffff' : theme.colors.textSecondary
          }}
        >
          <span>عربي فصحى 📚</span>
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: selectedCategory === 'standard' ? 'rgba(0,0,0,0.2)' : theme.colors.bgInput,
              color: selectedCategory === 'standard' ? '#ffffff' : theme.colors.textMuted
            }}
          >
            {ARABIC_STANDARD_WORDS.length}
          </span>
        </button>

        <button
          onClick={() => setSelectedCategory('iraqi')}
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-xs"
          style={{
            backgroundColor: selectedCategory === 'iraqi' ? theme.colors.accentPrimary : theme.colors.bgSurface,
            borderColor: selectedCategory === 'iraqi' ? theme.colors.accentPrimary : theme.colors.borderColor,
            color: selectedCategory === 'iraqi' ? '#ffffff' : theme.colors.textSecondary
          }}
        >
          <span>عراقي وعامي 🇮🇶</span>
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: selectedCategory === 'iraqi' ? 'rgba(0,0,0,0.2)' : theme.colors.bgInput,
              color: selectedCategory === 'iraqi' ? '#ffffff' : theme.colors.textMuted
            }}
          >
            {ARABIC_IRAQI_WORDS.length}
          </span>
        </button>

        <button
          onClick={() => setSelectedCategory('pop')}
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-xs"
          style={{
            backgroundColor: selectedCategory === 'pop' ? theme.colors.accentPrimary : theme.colors.bgSurface,
            borderColor: selectedCategory === 'pop' ? theme.colors.accentPrimary : theme.colors.borderColor,
            color: selectedCategory === 'pop' ? '#ffffff' : theme.colors.textSecondary
          }}
        >
          <span>ثقافة بوب وألعاب 🎮</span>
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: selectedCategory === 'pop' ? 'rgba(0,0,0,0.2)' : theme.colors.bgInput,
              color: selectedCategory === 'pop' ? '#ffffff' : theme.colors.textMuted
            }}
          >
            {POP_CULTURE_WORDS.length}
          </span>
        </button>

        <button
          onClick={() => setSelectedCategory('english')}
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-xs"
          style={{
            backgroundColor: selectedCategory === 'english' ? theme.colors.accentPrimary : theme.colors.bgSurface,
            borderColor: selectedCategory === 'english' ? theme.colors.accentPrimary : theme.colors.borderColor,
            color: selectedCategory === 'english' ? '#ffffff' : theme.colors.textSecondary
          }}
        >
          <span>English 🇬🇧</span>
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: selectedCategory === 'english' ? 'rgba(0,0,0,0.2)' : theme.colors.bgInput,
              color: selectedCategory === 'english' ? '#ffffff' : theme.colors.textMuted
            }}
          >
            {ENGLISH_WORDS.length}
          </span>
        </button>

        <button
          onClick={() => setSelectedCategory('custom')}
          className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-xs"
          style={{
            backgroundColor: selectedCategory === 'custom' ? theme.colors.accentPrimary : theme.colors.bgSurface,
            borderColor: selectedCategory === 'custom' ? theme.colors.accentPrimary : theme.colors.borderColor,
            color: selectedCategory === 'custom' ? '#ffffff' : theme.colors.textSecondary
          }}
        >
          <span>كلمات مخصصة ✨</span>
          <span 
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: selectedCategory === 'custom' ? 'rgba(0,0,0,0.2)' : theme.colors.bgInput,
              color: selectedCategory === 'custom' ? '#ffffff' : theme.colors.textMuted
            }}
          >
            {customWords.length}
          </span>
        </button>
      </div>

      {/* Add Custom Word Input */}
      {selectedCategory === 'custom' && (
        <form onSubmit={handleAddCustomWord} className="flex gap-2">
          <input
            type="text"
            value={newWordInput}
            onChange={(e) => setNewWordInput(e.target.value)}
            placeholder="أدخل كلمة جديدة لإضافتها إلى القاموس المخصص..."
            className="flex-1 border rounded-xl px-4 py-2.5 text-xs outline-none transition"
            style={{
              backgroundColor: theme.colors.bgInput,
              borderColor: theme.colors.borderColor,
              color: theme.colors.textPrimary
            }}
          />
          <button
            type="submit"
            disabled={!newWordInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#00c853] hover:bg-[#00b047] text-black text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة كلمة</span>
          </button>
        </form>
      )}

      {/* Words Grid Display */}
      <div 
        className="border rounded-2xl p-6 shadow-sm transition-colors"
        style={{
          backgroundColor: theme.colors.bgSurface,
          borderColor: theme.colors.borderColor
        }}
      >
        <div className="flex items-center justify-between mb-4 border-b pb-3" style={{ borderColor: theme.colors.borderColor }}>
          <span className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>
            الكلمات المعروضة: ({filteredWords.length})
          </span>
          <span className="text-xs" style={{ color: theme.colors.textMuted }}>
            يتم اختيار 25 كلمة عشوائياً في كل لعبة لإنشاء اللوحة 5×5
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {filteredWords.map((word, idx) => (
            <div
              key={idx}
              className="px-3 py-2 rounded-xl border text-center text-xs font-bold transition flex items-center justify-between group shadow-xs"
              style={{
                backgroundColor: theme.colors.bgInput,
                borderColor: theme.colors.borderColor,
                color: theme.colors.textPrimary
              }}
            >
              <span className="truncate flex-1">{word}</span>
              {selectedCategory === 'custom' && (
                <button
                  onClick={() => handleRemoveWord(word)}
                  className="transition mr-1 opacity-0 group-hover:opacity-100 hover:text-[#ef5350]"
                  style={{ color: theme.colors.textMuted }}
                  title="حذف الكلمة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
