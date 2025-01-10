const { google } = require('googleapis');
const { authenticate } = require('./auth');
const { DateTime } = require('luxon');

// 工作时间的默认值（东京时区）
const DEFAULT_WORKING_HOURS = {
  start: '00:00',
  end: '23:59'
};

const DEFAULT_TIMEZONE = 'Asia/Tokyo';

// 将时间字符串转换为指定时区的DateTime对象
function timeStringToDate(dateStr, timeStr, timezone = DEFAULT_TIMEZONE) {
  const [hours, minutes] = timeStr.split(':');
  return DateTime.fromFormat(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', {
    zone: timezone
  }).set({
    hour: parseInt(hours),
    minute: parseInt(minutes)
  });
}

// 检查两个时间段是否重叠
function isOverlapping(slot1, slot2) {
  return slot1.start < slot2.end && slot2.start < slot1.end;
}

// 从时间段中减去被占用的时间
function subtractBusyTime(freeSlot, busySlot) {
  if (!isOverlapping(freeSlot, busySlot)) {
    return [freeSlot];
  }

  const result = [];
  if (freeSlot.start < busySlot.start) {
    result.push({
      start: freeSlot.start,
      end: busySlot.start
    });
  }
  if (busySlot.end < freeSlot.end) {
    result.push({
      start: busySlot.end,
      end: freeSlot.end
    });
  }
  return result;
}

// 格式化日期为指定时区的ISO字符串
function formatToTimezone(date, timezone = DEFAULT_TIMEZONE) {
  return DateTime.fromJSDate(date)
    .setZone(timezone)
    .toISO({ suppressMilliseconds: true });
}

// 解析事件标题中的缓冲时间
function parseBufferTime(eventSummary) {
  const bufferMatch = eventSummary.match(/-B(\d+)A(\d+)/);
  if (bufferMatch) {
    return {
      before: parseInt(bufferMatch[1]) * 60 * 1000, // 转换为毫秒
      after: parseInt(bufferMatch[2]) * 60 * 1000   // 转换为毫秒
    };
  }
  return { before: 0, after: 0 };
}

async function getFreeTimeSlots(req, res) {
  try {
    const { 
      startDate, 
      endDate, 
      workingHours = DEFAULT_WORKING_HOURS,
      timezone = DEFAULT_TIMEZONE 
    } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    // 验证时区是否有效
    try {
      if (!DateTime.local().setZone(timezone).isValid) {
        throw new Error('Invalid timezone');
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timezone'
      });
    }

    const auth = await authenticate();
    const calendar = google.calendar({ version: 'v3', auth });

    // 获取日历列表
    const calendarList = await calendar.calendarList.list();
    const targetCalendars = calendarList.data.items.filter(cal => 
      cal.summary.toLowerCase() === 'main' || 
      cal.summary.toLowerCase() === 'block'
    );

    if (targetCalendars.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No main or block calendars found'
      });
    }

    // 获取所有忙碌时间
    const busySlots = [];
    for (const cal of targetCalendars) {
      const events = await calendar.events.list({
        calendarId: cal.id,
        timeMin: DateTime.fromISO(startDate).setZone(timezone).toISO(),
        timeMax: DateTime.fromISO(endDate).setZone(timezone).endOf('day').toISO(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: timezone
      });

      if (events.data.items) {
        events.data.items.forEach(event => {
          const { before, after } = parseBufferTime(event.summary || '');
          const eventStart = DateTime.fromISO(event.start.dateTime || event.start.date, { zone: timezone });
          const eventEnd = DateTime.fromISO(event.end.dateTime || event.end.date, { zone: timezone });
          
          // 应用缓冲时间
          busySlots.push({
            start: eventStart.minus({ milliseconds: before }).toJSDate(),
            end: eventEnd.plus({ milliseconds: after }).toJSDate()
          });
        });
      }
    }

    // 生成工作时间段
    const freeSlots = [];
    let currentDate = DateTime.fromISO(startDate, { zone: timezone });
    const endDateTime = DateTime.fromISO(endDate, { zone: timezone });

    while (currentDate <= endDateTime) {
      const currentDateStr = currentDate.toFormat('yyyy-MM-dd');
      const dayStart = timeStringToDate(currentDateStr, workingHours.start, timezone).toJSDate();
      const dayEnd = timeStringToDate(currentDateStr, workingHours.end, timezone).toJSDate();
      
      let daySlots = [{ start: dayStart, end: dayEnd }];

      // 从工作时间中减去所有忙碌时间
      for (const busySlot of busySlots) {
        const newDaySlots = [];
        for (const freeSlot of daySlots) {
          newDaySlots.push(...subtractBusyTime(freeSlot, busySlot));
        }
        daySlots = newDaySlots;
      }

      freeSlots.push(...daySlots);
      currentDate = currentDate.plus({ days: 1 });
    }

    // 过滤掉小于30分钟的时间段
    const minimumDuration = 30 * 60 * 1000; // 30分钟（毫秒）
    const filteredSlots = freeSlots.filter(slot => 
      (slot.end - slot.start) >= minimumDuration
    );

    res.json({
      success: true,
      timeRange: {
        start: startDate,
        end: endDate
      },
      timezone: timezone,
      freeSlots: filteredSlots.map(slot => ({
        start: formatToTimezone(slot.start, timezone),
        end: formatToTimezone(slot.end, timezone)
      }))
    });

  } catch (error) {
    console.error('Error getting free time slots:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = getFreeTimeSlots; 