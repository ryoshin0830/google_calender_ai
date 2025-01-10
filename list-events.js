const fs = require('fs');
const { google } = require('googleapis');
const { authenticate } = require('./auth');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 默认时区设置
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

// 获取所有日历
async function getCalendars(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const response = await calendar.calendarList.list();
    return response.data.items;
  } catch (error) {
    console.error('获取日历列表失败:', error.message);
    return null;
  }
}

// 解析日期范围
function parseDateRange(input) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 如果是数字，表示相对天数
  if (/^-?\d+$/.test(input)) {
    const days = parseInt(input);
    const start = new Date(today);
    const end = new Date(today);
    
    if (days >= 0) {
      // 正数：今天到未来N天
      end.setDate(today.getDate() + days);
    } else {
      // 负数：过去N天到今天
      start.setDate(today.getDate() + days);
    }
    return { start, end };
  }
  
  // 如果包含 '~'，表示具体的日期范围
  if (input.includes('~')) {
    const [startStr, endStr] = input.split('~').map(s => s.trim());
    const start = new Date(startStr);
    const end = new Date(endStr);
    end.setHours(23, 59, 59, 999); // 设置结束时间为当天最后一刻
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('无效的日期格式。请使用 YYYY-MM-DD 格式，例如: 2024-02-01~2024-02-07');
    }
    
    return { start, end };
  }
  
  throw new Error('无效的输入格式。请输入天数(如: 7 或 -7)或日期范围(如: 2024-02-01~2024-02-07)');
}

// 格式化日期时间
function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIMEZONE
  });
}

// 列出所有日历的事件
async function listAllEvents(auth, timeRange) {
  const calendar = google.calendar({ version: 'v3', auth });
  const calendars = await getCalendars(auth);
  if (!calendars) return;

  let allEvents = [];
  
  // 获取所有日历的事件
  for (const cal of calendars) {
    try {
      const response = await calendar.events.list({
        calendarId: cal.id,
        timeMin: timeRange.start.toISOString(),
        timeMax: timeRange.end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      if (response.data.items && response.data.items.length > 0) {
        // 为每个事件添加日历信息
        const events = response.data.items.map(event => ({
          ...event,
          calendarName: cal.summary
        }));
        allEvents = allEvents.concat(events);
      }
    } catch (error) {
      console.error(`获取日历 "${cal.summary}" 的事件失败:`, error.message);
    }
  }

  // 按时间排序
  allEvents.sort((a, b) => {
    const aTime = new Date(a.start.dateTime || a.start.date);
    const bTime = new Date(b.start.dateTime || b.start.date);
    return aTime - bTime;
  });

  if (allEvents.length === 0) {
    console.log('\n在指定时间范围内没有找到任何事件。');
    return;
  }

  console.log(`\n在 ${formatDateTime(timeRange.start)} 至 ${formatDateTime(timeRange.end)} 期间找到 ${allEvents.length} 个事件：`);
  allEvents.forEach((event, index) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    
    console.log(`\n${index + 1}. ${event.summary}`);
    console.log(`   日历: ${event.calendarName}`);
    console.log(`   时间: ${formatDateTime(start)} - ${formatDateTime(end)}`);
    if (event.description) console.log(`   描述: ${event.description}`);
    if (event.location) console.log(`   地点: ${event.location}`);
  });
}

async function main() {
  try {
    // 认证
    const auth = await authenticate();

    // 获取查询范围
    const range = await new Promise((resolve) => {
      rl.question('\n请输入查询范围:\n' +
        '- 输入天数表示相对范围，如：7 (未来7天) 或 -7 (过去7天)\n' +
        '- 输入日期范围，如：2024-02-01~2024-02-07\n' +
        '请输入: ', (answer) => {
        try {
          resolve(parseDateRange(answer.trim()));
        } catch (error) {
          console.error(error.message);
          process.exit(1);
        }
      });
    });

    // 列出所有日历的事件
    await listAllEvents(auth, range);

    rl.close();
  } catch (error) {
    console.error('发生错误:', error.message);
    rl.close();
    process.exit(1);
  }
}

main(); 