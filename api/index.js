const express = require('express');
const { google } = require('googleapis');
const { authenticate } = require('./auth');
const getFreeTimeSlots = require('./free-slots');
const { DateTime } = require('luxon');

const router = express.Router();
const DEFAULT_TIMEZONE = 'Asia/Tokyo';

// 解析日期范围，考虑时区
function parseDateRange(input, timezone = DEFAULT_TIMEZONE) {
  try {
    const now = DateTime.now().setZone(timezone).startOf('day');

    if (input.days !== undefined) {
      const days = parseInt(input.days);
      let start, end;
      
      if (days >= 0) {
        start = now;
        end = now.plus({ days });
      } else {
        start = now.plus({ days });
        end = now;
      }
      
      return {
        start: start.toJSDate(),
        end: end.endOf('day').toJSDate()
      };
    }
    
    if (input.startDate && input.endDate) {
      const start = DateTime.fromISO(input.startDate, { zone: timezone }).startOf('day');
      const end = DateTime.fromISO(input.endDate, { zone: timezone }).endOf('day');
      
      if (!start.isValid || !end.isValid) {
        throw new Error('Invalid date format. Please use YYYY-MM-DD format');
      }
      
      return {
        start: start.toJSDate(),
        end: end.toJSDate()
      };
    }
    
    throw new Error('Invalid input format');
  } catch (error) {
    throw new Error(`Date parsing error: ${error.message}`);
  }
}

// 优化获取日历事件的函数，添加时区支持
async function listAllEvents(auth, timeRange, timezone = DEFAULT_TIMEZONE) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  try {
    const calendarList = await Promise.race([
      calendar.calendarList.list(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('获取日历列表超时')), 8000)
      )
    ]);
    
    const calendars = calendarList.data.items;
    let allEvents = [];
    
    const eventPromises = calendars.map(cal => 
      calendar.events.list({
        calendarId: cal.id,
        timeMin: timeRange.start.toISOString(),
        timeMax: timeRange.end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: timezone
      }).then(response => {
        if (response.data.items && response.data.items.length > 0) {
          return response.data.items.map(event => {
            // 使用 Luxon 处理时间和时区
            const startDateTime = event.start.dateTime 
              ? DateTime.fromISO(event.start.dateTime, { zone: timezone })
              : DateTime.fromISO(event.start.date, { zone: timezone }).startOf('day');
            
            const endDateTime = event.end.dateTime
              ? DateTime.fromISO(event.end.dateTime, { zone: timezone })
              : DateTime.fromISO(event.end.date, { zone: timezone }).endOf('day');

            return {
              id: event.id,
              title: event.summary,
              calendar: cal.summary,
              calendarId: cal.id,
              start: startDateTime.toISO(),
              end: endDateTime.toISO(),
              description: event.description || null,
              location: event.location || null,
              timezone: timezone
            };
          });
        }
        return [];
      }).catch(error => {
        console.error(`获取日历 "${cal.summary}" 的事件失败:`, error.message);
        return [];
      })
    );

    const results = await Promise.race([
      Promise.all(eventPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('获取事件超时')), 8000)
      )
    ]);

    allEvents = results.flat();
    allEvents.sort((a, b) => DateTime.fromISO(a.start) - DateTime.fromISO(b.start));
    
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

// 优化添加事件的函数，改进时区处理
async function addEvents(auth, events, timezone = DEFAULT_TIMEZONE) {
  const calendar = google.calendar({ version: 'v3', auth });
  const results = [];
  const batchSize = 5;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const batchPromises = batch.map(event => {
      // 使用 Luxon 处理时间和时区
      const eventTimezone = event.timezone || timezone;
      const startDateTime = DateTime.fromISO(event.start, { zone: eventTimezone });
      const endDateTime = DateTime.fromISO(event.end, { zone: eventTimezone });

      if (!startDateTime.isValid || !endDateTime.isValid) {
        return Promise.resolve({
          success: false,
          title: event.title,
          error: 'Invalid date format'
        });
      }

      const calendarEvent = {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: {
          dateTime: startDateTime.toISO(),
          timeZone: eventTimezone
        },
        end: {
          dateTime: endDateTime.toISO(),
          timeZone: eventTimezone
        }
      };

      const targetCalendarId = event.calendarId || 'primary';

      return calendar.events.insert({
        calendarId: targetCalendarId,
        resource: calendarEvent,
      }).then(response => ({
        success: true,
        eventId: response.data.id,
        title: event.title,
        calendarId: targetCalendarId,
        timezone: eventTimezone
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

// API 路由
router.post('/events/list', async (req, res) => {
  try {
    const timezone = req.body.timezone || DEFAULT_TIMEZONE;
    const auth = await authenticate();
    const timeRange = parseDateRange(req.body, timezone);
    const events = await listAllEvents(auth, timeRange, timezone);
    
    res.json({
      success: true,
      timeRange: {
        start: DateTime.fromJSDate(timeRange.start, { zone: timezone }).toISO(),
        end: DateTime.fromJSDate(timeRange.end, { zone: timezone }).toISO()
      },
      timezone: timezone,
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

router.post('/events/add', async (req, res) => {
  try {
    const timezone = req.body.timezone || DEFAULT_TIMEZONE;
    const auth = await authenticate();
    const results = await addEvents(auth, req.body.events, timezone);
    
    res.json({
      success: true,
      timezone: timezone,
      results: results
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/events/delete', async (req, res) => {
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

router.post('/events/free-slots', getFreeTimeSlots);

router.get('/calendars', async (req, res) => {
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

router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 