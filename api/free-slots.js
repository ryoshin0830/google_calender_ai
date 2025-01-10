const { google } = require('googleapis');
const { authenticate } = require('./auth');

// 工作时间的默认值（东京时区）
const DEFAULT_WORKING_HOURS = {
  start: '09:00',
  end: '18:00'
};

const DEFAULT_TIMEZONE = 'Asia/Tokyo';

// 将时间字符串转换为指定时区的Date对象
function timeStringToDate(dateStr, timeStr, timezone = DEFAULT_TIMEZONE) {
  const [hours, minutes] = timeStr.split(':');
  // 使用给定的时区创建日期
  const date = new Date(dateStr);
  // 获取时区偏移
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 解析格式化后的日期字符串
  const parts = formatter.format(date).split(/[/,\s:]/);
  const tzDate = new Date(
    parseInt(parts[2]), // year
    parseInt(parts[0]) - 1, // month
    parseInt(parts[1]), // day
    parseInt(hours),
    parseInt(minutes),
    0,
    0
  );
  
  return tzDate;
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
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
  return new Date(formatter.format(date)).toISOString();
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
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
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
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate + 'T23:59:59').toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: timezone
      });

      if (events.data.items) {
        events.data.items.forEach(event => {
          busySlots.push({
            start: new Date(event.start.dateTime || event.start.date),
            end: new Date(event.end.dateTime || event.end.date)
          });
        });
      }
    }

    // 生成工作时间段
    const freeSlots = [];
    let currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);

    while (currentDate <= endDateTime) {
      const dayStart = timeStringToDate(currentDate.toISOString().split('T')[0], workingHours.start, timezone);
      const dayEnd = timeStringToDate(currentDate.toISOString().split('T')[0], workingHours.end, timezone);
      
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
      currentDate.setDate(currentDate.getDate() + 1);
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