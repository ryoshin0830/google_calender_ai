const axios = require('axios');
const { DateTime } = require('luxon');

const API_BASE_URL = 'https://google-calender-ai.vercel.app/api';
const TIMEZONE = 'Asia/Tokyo';

async function testHealth() {
  console.log('\n=== Testing Health Check ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log('Health Check Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Health Check Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
  }
}

async function testListEvents() {
  console.log('\n=== Testing List Events ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/events/list`, {
      days: 7,
      timezone: TIMEZONE
    });
    console.log('List Events Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('List Events Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
  }
}

async function testAddEvent() {
  console.log('\n=== Testing Add Event ===');
  try {
    const now = DateTime.now().setZone(TIMEZONE);
    const startTime = now.plus({ hours: 1 }).startOf('hour');
    const endTime = startTime.plus({ hours: 1 });

    const response = await axios.post(`${API_BASE_URL}/events/add`, {
      events: [{
        title: "Test Event API",
        description: "This is a test event created by API",
        start: startTime.toISO(),
        end: endTime.toISO(),
        timezone: TIMEZONE
      }],
      timezone: TIMEZONE
    });
    console.log('Add Event Response:', JSON.stringify(response.data, null, 2));
    return response.data.results[0];
  } catch (error) {
    console.error('Add Event Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
  }
}

async function testDeleteEvent(eventData) {
  if (!eventData) return;
  
  console.log('\n=== Testing Delete Event ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/events/delete`, {
      events: [{
        id: eventData.eventId,
        calendarId: eventData.calendarId
      }]
    });
    console.log('Delete Event Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Delete Event Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
  }
}

async function testFreeSlots() {
  console.log('\n=== Testing Free Slots ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/events/free-slots`, {
      startDate: "2025-01-11",
      endDate: "2025-01-12",
      timezone: "Asia/Shanghai"
    });
    console.log('Free Slots Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Free Slots Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
  }
}

async function runTests() {
  try {
    // 1. 测试健康检查
    await testHealth();

    // 2. 测试添加事件
    const addedEvent = await testAddEvent();
    if (!addedEvent || !addedEvent.eventId) {
      console.error('Failed to add event');
      return;
    }
    console.log('Successfully added event:', addedEvent.eventId);

    // 3. 等待一下以确保事件已经被添加
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. 测试列出事件
    await testListEvents();

    // 5. 测试查询空闲时间段
    await testFreeSlots();

    // 6. 测试删除事件
    await testDeleteEvent(addedEvent);

    // 7. 再次等待以确保事件已被删除
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 8. 再次列出事件以验证删除
    await testListEvents();
  } catch (error) {
    console.error('Test Error:', error);
  }
}

runTests(); 