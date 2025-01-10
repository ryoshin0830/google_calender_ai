const express = require('express');
const getFreeTimeSlots = require('./api/free-slots');

const app = express();
app.use(express.json());

app.post('/api/free-slots', getFreeTimeSlots);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 