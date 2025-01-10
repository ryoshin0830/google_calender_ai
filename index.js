const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { parse } = require('csv-parse');
const { authenticate } = require('./auth');
const readline = require('readline');

// 默认时区设置
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 读取并解析 CSV 文件
async function readCSV(filePath) {
  const records = [];
  const parser = fs
    .createReadStream(filePath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true // 清理字段值中的空格
    }));

  for await (const record of parser) {
    records.push(record);
  }
  return records;
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
    rl.question('\n请选择要添加事件的日历 (输入编号): ', (answer) => {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < calendars.length) {
        resolve(calendars[index]);
      } else {
        console.log('使用默认日历 (primary)');
        resolve({ id: 'primary' });
      }
    });
  });
}

// 创建日历事件
async function createEvent(auth, event, calendarId) {
  const calendar = google.calendar({ version: 'v3', auth });
  // 清理时区值中的空格
  const timezone = (event.timezone || DEFAULT_TIMEZONE).trim();
  
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
    console.log('Event created:', event.title, '(Timezone:', timezone, ')');
    return response.data;
  } catch (error) {
    console.error('Error creating event:', error.message);
    return null;
  }
}

async function main() {
  try {
    // 检查命令行参数
    if (process.argv.length < 3) {
      console.error('请提供 CSV 文件路径');
      process.exit(1);
    }

    const csvPath = process.argv[2];
    if (!fs.existsSync(csvPath)) {
      console.error('CSV 文件不存在');
      process.exit(1);
    }

    // 认证
    const auth = await authenticate();
    
    // 列出并选择日历
    const calendars = await listCalendars(auth);
    if (!calendars) {
      console.error('无法获取日历列表，将使用默认日历');
      process.exit(1);
    }
    const selectedCalendar = await selectCalendar(calendars);
    
    // 读取 CSV 文件
    const events = await readCSV(csvPath);
    console.log(`\n读取到 ${events.length} 个事件`);

    // 批量创建事件
    for (const event of events) {
      await createEvent(auth, event, selectedCalendar.id);
    }

    console.log('\n所有事件已添加完成');
    rl.close();
  } catch (error) {
    console.error('发生错误:', error.message);
    rl.close();
    process.exit(1);
  }
}

main(); 