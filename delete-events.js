const fs = require('fs');
const { google } = require('googleapis');
const { authenticate } = require('./auth');
const readline = require('readline');
const { parse } = require('csv-parse/sync');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 读取 CSV 文件中的事件信息
function readTestEvents() {
  try {
    const fileContent = fs.readFileSync('events.csv', 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    return records;
  } catch (error) {
    console.error('读取 events.csv 失败:', error.message);
    return [];
  }
}

// 列出所有可用的日历
async function listCalendars(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const response = await calendar.calendarList.list();
    return response.data.items;
  } catch (error) {
    console.error('获取日历列表失败:', error.message);
    return null;
  }
}

// 列出日历中的测试事件
async function listTestEvents(auth, calendarId, calendarName) {
  const calendar = google.calendar({ version: 'v3', auth });
  const testEvents = readTestEvents();
  
  try {
    // 设置时间范围为测试事件的时间范围
    const timeMin = new Date(Math.min(...testEvents.map(e => new Date(e.start)))).toISOString();
    const timeMax = new Date(Math.max(...testEvents.map(e => new Date(e.end)))).toISOString();

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    if (!events || events.length === 0) {
      return [];
    }

    // 过滤出与 CSV 文件中标题匹配的事件
    const testTitles = new Set(testEvents.map(e => e.title));
    const matchingEvents = events.filter(event => testTitles.has(event.summary));

    if (matchingEvents.length > 0) {
      console.log(`\n在日历 "${calendarName}" 中找到以下测试事件:`);
      matchingEvents.forEach((event, index) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${index + 1}. ${event.summary} (${start})`);
      });
    }
    return matchingEvents;
  } catch (error) {
    console.error(`获取日历 "${calendarName}" 的事件列表失败:`, error.message);
    return [];
  }
}

// 确认删除
async function confirmDeletion(calendarEvents) {
  if (Object.keys(calendarEvents).length === 0) {
    console.log('\n没有找到任何测试事件。');
    return {};
  }

  console.log('\n这些是从 events.csv 文件添加的所有测试事件。');
  return new Promise((resolve) => {
    rl.question('\n是否删除所有这些测试事件？(yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('已取消删除操作');
        resolve({});
        return;
      }

      console.log('\n你将要删除以下事件:');
      for (const [calendarName, events] of Object.entries(calendarEvents)) {
        if (events.length > 0) {
          console.log(`\n在日历 "${calendarName}" 中:`);
          events.forEach(event => {
            const start = event.start.dateTime || event.start.date;
            console.log(`- ${event.summary} (${start})`);
          });
        }
      }

      const finalConfirmation = await new Promise(resolve => {
        rl.question('\n⚠️ 最后确认：这些事件将被永久删除，确定要继续吗？(yes/no): ', (answer) => {
          resolve(answer.toLowerCase() === 'yes');
        });
      });

      if (finalConfirmation) {
        resolve(calendarEvents);
      } else {
        console.log('已取消删除操作');
        resolve({});
      }
    });
  });
}

// 删除事件
async function deleteEvents(auth, calendarEvents) {
  const calendar = google.calendar({ version: 'v3', auth });
  for (const [calendarId, events] of Object.entries(calendarEvents)) {
    for (const event of events) {
      try {
        await calendar.events.delete({
          calendarId: calendarId,
          eventId: event.id
        });
        console.log(`已从日历中删除: ${event.summary}`);
      } catch (error) {
        console.error(`删除事件 ${event.summary} 失败:`, error.message);
      }
    }
  }
}

async function main() {
  try {
    // 认证
    const auth = await authenticate();
    
    // 获取所有日历
    const calendars = await listCalendars(auth);
    if (!calendars) {
      console.error('无法获取日历列表');
      process.exit(1);
    }

    console.log('\n正在检查所有日历中的测试事件...');
    
    // 在所有日历中查找测试事件
    const calendarEvents = {};
    for (const calendar of calendars) {
      const events = await listTestEvents(auth, calendar.id, calendar.summary);
      if (events.length > 0) {
        calendarEvents[calendar.id] = events;
      }
    }

    // 确认并删除事件
    const eventsToDelete = await confirmDeletion(calendarEvents);
    if (Object.keys(eventsToDelete).length > 0) {
      await deleteEvents(auth, eventsToDelete);
      console.log('\n删除操作完成');
    }

    rl.close();
  } catch (error) {
    console.error('发生错误:', error.message);
    rl.close();
    process.exit(1);
  }
}

main(); 