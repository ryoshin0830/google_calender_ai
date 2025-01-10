const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';
const TIMEZONE = 'Asia/Tokyo';

async function testListEvents() {
  console.log('\n=== Testing List Events ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/events/list`, {
      days: 7,
      timezone: TIMEZONE
    });
    console.log('List Events Response:', JSON.stringify(response.data, null, 2));
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
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later
    
    const response = await axios.post(`${API_BASE_URL}/events/add`, {
      timezone: TIMEZONE,
      events: [{
        title: 'Test Event with Buffer -B15A10',
        description: 'This is a test event',
        start: now.toISOString(),
        end: later.toISOString(),
        timezone: TIMEZONE
      }]
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
    return null;
  }
}

async function testFreeSlots() {
  console.log('\n=== Testing Free Slots ===');
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const response = await axios.post(`${API_BASE_URL}/events/free-slots`, {
      startDate: today.toISOString().split('T')[0],
      endDate: tomorrow.toISOString().split('T')[0],
      workingHours: {
        start: '09:00',
        end: '18:00'
      },
      timezone: TIMEZONE
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

// 首先测试健康检查端点
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

async function runTests() {
  try {
    // 首先测试健康检查
    await testHealth();
    
    // 测试列出事件
    await testListEvents();
    
    // 测试添加事件
    const addedEvent = await testAddEvent();
    
    // 测试查询空闲时段
    await testFreeSlots();
    
    // 测试删除事件
    await testDeleteEvent(addedEvent);
    
  } catch (error) {
    console.error('Test Error:', error);
  }
}

// 运行测试
runTests(); 