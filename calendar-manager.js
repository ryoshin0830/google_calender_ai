const fs = require('fs');
const { google } = require('googleapis');
const { authenticate } = require('./auth');
const readline = require('readline');
const { parse } = require('csv-parse/sync');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 默认时区设置
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

// 读取 CSV 文件中的事件信息
function readEventsFromCSV() {
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
    const calendars = response.data.items;
    console.log('\n可用的日历:');
    calendars.forEach((cal, index) => {
      console.log(`${index + 1}. ${cal.summary} (${cal.id})`);
    });
    return calendars;
  } catch (error) {
    console.error('获取日历列表失败:', error.message);
    return null;
  }
}

// 选择日历
async function selectCalendar(calendars) {
  return new Promise((resolve) => {
    rl.question('\n请选择日历 (输入编号): ', (answer) => {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < calendars.length) {
        resolve(calendars[index]);
      } else {
        console.log('使用默认日历 (primary)');
        resolve({ id: 'primary', summary: '主日历' });
      }
    });
  });
}

// 创建日历事件
async function createEvent(auth, calendarId, event) {
  const calendar = google.calendar({ version: 'v3', auth });
  const timezone = event.timezone || DEFAULT_TIMEZONE;
  
  const calendarEvent = {
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: {
      dateTime: new Date(event.start).toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: new Date(event.end).toISOString(),
      timeZone: timezone,
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: calendarEvent,
    });
    console.log(`已创建事件: ${event.title} (${timezone})`);
    return response.data;
  } catch (error) {
    console.error(`创建事件 ${event.title} 失败:`, error.message);
    return null;
  }
}

// 列出日历中的匹配事件
async function listMatchingEvents(auth, calendarId, calendarName, csvEvents) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  try {
    // 设置时间范围为CSV事件的时间范围
    const timeMin = new Date(Math.min(...csvEvents.map(e => new Date(e.start)))).toISOString();
    const timeMax = new Date(Math.max(...csvEvents.map(e => new Date(e.end)))).toISOString();

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
    const csvTitles = new Set(csvEvents.map(e => e.title));
    const matchingEvents = events.filter(event => csvTitles.has(event.summary));

    if (matchingEvents.length > 0) {
      console.log(`\n在日历 "${calendarName}" 中找到以下匹配事件:`);
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

// 确认删除事件
async function confirmDeletion(calendarEvents) {
  if (Object.keys(calendarEvents).length === 0) {
    console.log('\n没有找到任何匹配的事件。');
    return {};
  }

  return new Promise((resolve) => {
    console.log('\n这些是与 events.csv 文件中的事件匹配的日历事件。');
    rl.question('\n是否删除所有这些事件？(yes/no): ', async (answer) => {
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
        console.log(`已删除事件: ${event.summary}`);
      } catch (error) {
        console.error(`删除事件 ${event.summary} 失败:`, error.message);
      }
    }
  }
}

// 显示事件详情
function displayEvents(events) {
  console.log('\n将要添加以下事件:');
  events.forEach((event, index) => {
    console.log(`\n${index + 1}. ${event.title}`);
    console.log(`   开始时间: ${event.start}`);
    console.log(`   结束时间: ${event.end}`);
    if (event.description) console.log(`   描述: ${event.description}`);
    if (event.location) console.log(`   地点: ${event.location}`);
    console.log(`   时区: ${event.timezone || DEFAULT_TIMEZONE}`);
  });
}

// 添加事件
async function addEvents(auth, calendarId, events) {
  displayEvents(events);
  console.log(`\n准备添加 ${events.length} 个事件...`);
  for (const event of events) {
    await createEvent(auth, calendarId, event);
  }
  console.log('\n添加操作完成');
}

async function main() {
  try {
    // 读取 CSV 文件
    const csvEvents = readEventsFromCSV();
    if (csvEvents.length === 0) {
      console.error('CSV 文件为空或无法读取');
      process.exit(1);
    }

    // 认证
    const auth = await authenticate();
    
    // 获取所有日历
    const calendars = await listCalendars(auth);
    if (!calendars) {
      console.error('无法获取日历列表');
      process.exit(1);
    }

    // 选择操作
    const operation = await new Promise((resolve) => {
      rl.question('\n请选择操作:\n1. 添加事件\n2. 删除事件\n请输入操作编号: ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (operation === '1') {
      // 添加事件
      const selectedCalendar = await selectCalendar(calendars);
      console.log(`\n已选择日历: ${selectedCalendar.summary}`);
      
      // 显示要添加的事件
      displayEvents(csvEvents);
      
      const confirmation = await new Promise((resolve) => {
        rl.question('\n确认要添加这些事件吗？(yes/no): ', (answer) => {
          resolve(answer.toLowerCase() === 'yes');
        });
      });

      if (confirmation) {
        await addEvents(auth, selectedCalendar.id, csvEvents);
      } else {
        console.log('已取消添加操作');
      }
    } else if (operation === '2') {
      // 删除事件
      console.log('\n正在所有日历中查找匹配的事件...');
      const calendarEvents = {};
      for (const calendar of calendars) {
        const events = await listMatchingEvents(auth, calendar.id, calendar.summary, csvEvents);
        if (events.length > 0) {
          calendarEvents[calendar.id] = events;
        }
      }

      const eventsToDelete = await confirmDeletion(calendarEvents);
      if (Object.keys(eventsToDelete).length > 0) {
        await deleteEvents(auth, eventsToDelete);
        console.log('\n删除操作完成');
      }
    } else {
      console.log('无效的操作选择');
    }

    rl.close();
  } catch (error) {
    console.error('发生错误:', error.message);
    rl.close();
    process.exit(1);
  }
}

main(); 