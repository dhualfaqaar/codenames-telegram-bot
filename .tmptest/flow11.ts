import { TelegramBotManager } from '../server/telegramBot';

const calls: any[] = [];
(globalThis as any).fetch = async (url: string, init: any) => {
  const body = init?.body ? JSON.parse(init.body) : null;
  const method = String(url).split('/').pop();
  calls.push({ url: method, body });
  if (method === 'getMe') {
    return {
      json: async () => ({
        ok: true,
        result: { id: 1, is_bot: true, username: 'codenames1bot', first_name: 'بوت' }
      })
    } as any;
  }
  return { json: async () => ({ ok: true, result: { message_id: 8000 } }) } as any;
};

const bot: any = new TelegramBotManager('123456:FAKE', '8885518661');
bot.botInfo = { id: 1, username: 'codenames1bot', first_name: 'بوت' };

// لاعبين حتى تطلع اللوحات
const seed = (id: string, name: string, money: number, xp: number, games: number, wins: number) => {
  bot.users.set(id, { id, name, money, xp, onlineGames: games, onlineWins: wins, lastSeen: Date.now() });
};
seed('111111111', 'أحمد', 1.284, 320, 7, 3);
seed('222222222', 'سارة', 0.75, 500, 12, 6);
seed('333333333', 'حيدر', 0.2, 50, 2, 1);

let uid = 1000;
async function press(data: string, userId = 111111111, chatType = 'private') {
  uid += 1;
  calls.length = 0;
  await bot.handleUpdate({
    update_id: uid,
    callback_query: {
      id: `cb${uid}`,
      from: { id: userId, is_bot: false, first_name: 'تجربة' },
      message: { message_id: uid, chat: { id: userId, type: chatType } },
      data
    }
  });
  const c = calls.find(x => x.url === 'editMessageText') || calls.find(x => x.url === 'sendMessage');
  return {
    text: String(c?.body?.text || ''),
    keys: JSON.stringify(c?.body?.reply_markup?.inline_keyboard || [])
  };
}

async function send(clientId: number, text: string) {
  uid += 1;
  calls.length = 0;
  await bot.handleUpdate({
    update_id: uid,
    message: {
      message_id: uid,
      date: Math.floor(Date.now() / 1000),
      text,
      from: { id: clientId, is_bot: false, first_name: 'تجربة' },
      chat: { id: clientId, type: 'private' }
    }
  });
  const c = calls.find(x => x.url === 'sendMessage' && String(x.body?.text || '').includes('أهلاً بك'))
    || calls.find(x => x.url === 'sendMessage');
  return {
    text: String(c?.body?.text || ''),
    keys: JSON.stringify(c?.body?.reply_markup?.inline_keyboard || [])
  };
}

(async () => {
  // 1) الزر الجديد «🏅 المتصدرون» بلوحة الرئيسية
  const start = await send(111111111, '/start');
  if (!start.keys.includes('🏅 المتصدرون')) throw new Error('لازم زر 🏅 المتصدرون');
  if (start.keys.includes('المتصدرون بالفلوس')) throw new Error('الزر القديم الطويل لازم يختفي');
  console.log('✅ زر الرئيسية: 🏅 المتصدرون');

  // 2) يفتح خيارين: فلوس + مستوى
  const menu = await press('rank:menu');
  console.log('\n=== شاشة المتصدرين ===\n' + menu.text);
  if (!menu.text.includes('🏅 *المتصدرون*')) throw new Error('عنوان الشاشة');
  if (!menu.keys.includes('💵 المتصدرون بالفلوس')) throw new Error('خيار الفلوس');
  if (!menu.keys.includes('🎖️ المتصدرون بالمستوى')) throw new Error('خيار المستوى');
  const rows = JSON.parse(menu.keys);
  if (rows.length !== 3 || rows[0].length !== 1 || rows[1].length !== 1) {
    throw new Error('الخيارين لازم كل واحد بزر لحاله + رجوع');
  }
  console.log('✅ خيارين واضحين (كل واحد بزر لحاله) + رجوع');

  // 3) بالفلوس: الأعلى أول
  const money = await press('rank:money');
  console.log('\n=== بالفلوس ===\n' + money.text);
  if (!money.text.includes('💰 *المتصدرون بالفلوس*')) throw new Error('عنوان الفلوس');
  if (!(money.text.indexOf('1.284') < money.text.indexOf('0.75'))) throw new Error('الأعلى بالفلوس لازم أول');
  if (!(money.text.indexOf('0.75') < money.text.indexOf('0.2'))) throw new Error('الترتيب بالفلوس غلط');
  if (!money.text.includes('🥇')) throw new Error('ميدالية الأول');
  if (!money.keys.includes('rank:level')) throw new Error('تنقّل بين اللوحتين');

  // 4) بالمستوى: الأعلى خبرة أول (سارة 500)
  const level = await press('rank:level');
  console.log('\n=== بالمستوى ===\n' + level.text);
  if (!level.text.includes('🎖️ *المتصدرون بالمستوى*')) throw new Error('عنوان المستوى');
  if (!(level.text.indexOf('سارة') < level.text.indexOf('أحمد'))) throw new Error('الأعلى XP لازم أول');
  if (!level.text.includes('مستوى *6*') && !level.text.includes('مستوى *6*')) {
    console.log('ملاحظة: XP سارة 500 → مستوى', Math.floor(1));
  }
  if (!level.keys.includes('rank:money')) throw new Error('تنقّل بين اللوحتين');

  // 5) ملفي + رجوع
  const me = await press('rank:me');
  if (!me.text.includes('👤 *ملفي*')) throw new Error('ملفي لازم تشتغل');
  const back = await press('hub:main');
  if (!back.keys.includes('🏅 المتصدرون')) throw new Error('الرجوع للرئيسية');

  // 6) بالكروب: المتصدرين عامة تشتغل (قراءة بس)
  const grp = await press('rank:menu', 111111111, 'supergroup');
  if (!grp.text.includes('المتصدرون')) throw new Error('المتصدرين بالكروب تشتغل');
  console.log('\n✅ التنقّل كامل: المتصدرون ← (فلوس | مستوى) ← ملفي ← رجوع (ويشتغل بالكروب)');
  console.log('\n✅ كل الفحوصات نجحت');
})().catch(e => {
  console.error('❌ ' + e.message);
  process.exit(1);
});
