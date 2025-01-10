const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { authenticate } = require('./auth');
const getFreeTimeSlots = require('./free-slots');

const app = express();

// 配置 CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL] // 生产环境只允许特定域名
    : true, // 开发环境允许所有域名
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

const DEFAULT_TIMEZONE = 'Asia/Shanghai';

// 解析日期范围
function parseDateRange(input) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (input.days !== undefined) {
    const days = parseInt(input.days);
    const start = new Date(today);
    const end = new Date(today);
    
    if (days >= 0) {
      end.setDate(today.getDate() + days);
    } else {
      start.setDate(today.getDate() + days);
    }
    return { start, end };
  }
  
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Please use YYYY-MM-DD format');
    }
    
    return { start, end };
  }
  
  throw new Error('Invalid input format');
}

// 优化获取日历事件的函数
async function listAllEvents(auth, timeRange) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  try {
    // 获取所有日历，设置超时
    const calendarList = await Promise.race([
      calendar.calendarList.list(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('获取日历列表超时')), 8000)
      )
    ]);
    
    const calendars = calendarList.data.items;
    let allEvents = [];
    
    // 并行获取所有日历的事件
    const eventPromises = calendars.map(cal => 
      calendar.events.list({
        calendarId: cal.id,
        timeMin: timeRange.start.toISOString(),
        timeMax: timeRange.end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      }).then(response => {
        if (response.data.items && response.data.items.length > 0) {
          return response.data.items.map(event => ({
            id: event.id,
            title: event.summary,
            calendar: cal.summary,
            calendarId: cal.id,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            description: event.description || null,
            location: event.location || null
          }));
        }
        return [];
      }).catch(error => {
        console.error(`获取日历 "${cal.summary}" 的事件失败:`, error.message);
        return [];
      })
    );

    // 使用 Promise.all 并设置总体超时
    const results = await Promise.race([
      Promise.all(eventPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('获取事件超时')), 8000)
      )
    ]);

    allEvents = results.flat();
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    return allEvents;
  } catch (error) {
    if (error.message.includes('超时')) {
      throw error;
    }
    throw new Error(`获取事件失败: ${error.message}`);
  }
}

// 获取所有日历
async function listCalendars(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    const response = await calendar.calendarList.list();
    return response.data.items.map(cal => ({
      id: cal.id,
      name: cal.summary,
      description: cal.description,
      primary: cal.primary || false
    }));
  } catch (error) {
    throw new Error(`获取日历列表失败: ${error.message}`);
  }
}

// 优化添加事件的函数
async function addEvents(auth, events) {
  const calendar = google.calendar({ version: 'v3', auth });
  const results = [];
  const batchSize = 5; // 每批处理的事件数

  // 将事件分批处理
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchPromises = batch.map(event => {
      const calendarEvent = {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: {
          dateTime: new Date(event.start).toISOString(),
          timeZone: event.timezone || DEFAULT_TIMEZONE,
        },
        end: {
          dateTime: new Date(event.end).toISOString(),
          timeZone: event.timezone || DEFAULT_TIMEZONE,
        },
      };

      // 使用指定的日历ID，如果没有指定则使用主日历
      const targetCalendarId = event.calendarId || 'primary';

      return calendar.events.insert({
        calendarId: targetCalendarId,
        resource: calendarEvent,
      }).then(response => ({
        success: true,
        eventId: response.data.id,
        title: event.title,
        calendarId: targetCalendarId
      })).catch(error => ({
        success: false,
        title: event.title,
        calendarId: targetCalendarId,
        error: error.message
      }));
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// 优化删除事件的函数
async function deleteEvents(auth, events) {
  const calendar = google.calendar({ version: 'v3', auth });
  const results = [];
  const batchSize = 5; // 每批处理的事件数

  // 将删除操作分批处理
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchPromises = batch.map(event => 
      calendar.events.delete({
        calendarId: event.calendarId,
        eventId: event.id
      }).then(() => ({
        success: true,
        eventId: event.id,
        title: event.title
      })).catch(error => ({
        success: false,
        eventId: event.id,
        title: event.title,
        error: error.message
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// 添加空闲时间查询路由
app.post('/api/events/free-slots', getFreeTimeSlots);

// API 路由
app.post('/api/events/list', async (req, res) => {
  try {
    const auth = await authenticate();
    const timeRange = parseDateRange(req.body);
    const events = await listAllEvents(auth, timeRange);
    
    res.json({
      success: true,
      timeRange: {
        start: timeRange.start,
        end: timeRange.end
      },
      count: events.length,
      events: events
    });
  } catch (error) {
    const status = error.message.includes('超时') ? 504 : 400;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

// 添加事件
app.post('/api/events/add', async (req, res) => {
  try {
    const auth = await authenticate();
    const results = await addEvents(auth, req.body.events);
    
    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 删除事件
app.post('/api/events/delete', async (req, res) => {
  try {
    const auth = await authenticate();
    const results = await deleteEvents(auth, req.body.events);
    
    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 添加获取日历列表的端点
app.get('/api/calendars', async (req, res) => {
  try {
    const auth = await authenticate();
    const calendars = await listCalendars(auth);
    res.json({
      success: true,
      calendars: calendars
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Vercel 需要导出 app
module.exports = app;

// 只在非 Vercel 环境下启动服务器
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} 