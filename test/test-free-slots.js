const axios = require('axios');

async function testFreeSlots() {
  try {
    const response = await axios.post('http://localhost:3000/api/free-slots', {
      startDate: '2024-02-20',
      endDate: '2024-02-21',
      workingHours: {
        start: '09:00',
        end: '18:00'
      },
      timezone: 'Asia/Tokyo'
    });

    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testFreeSlots(); 