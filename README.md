# Google Calendar Free Slots API

This API helps you find available time slots in your Google Calendar, taking into account your working hours and existing calendar events. It supports multiple calendars, timezone handling, and buffer times for meetings.

## Features

- Find free time slots between specified dates
- Respect working hours
- Support for multiple time zones
- Buffer time support for meetings (using event title format)
- Minimum slot duration filtering (30 minutes)
- Multiple calendar support (main and block calendars)

## Prerequisites

- Node.js (v16 or higher)
- Google Calendar API credentials
- Google Calendar API enabled in Google Cloud Console

## Installation

1. Clone the repository:
```bash
git clone [your-repository-url]
cd google-calendar
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `.env`:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

## API Usage

### Start the Server

```bash
node server.js
```

The server will start on port 3000 by default.

### API Endpoints

#### GET Free Time Slots

`POST /api/free-slots`

Request body:
```json
{
  "startDate": "2024-02-20",
  "endDate": "2024-02-21",
  "workingHours": {
    "start": "09:00",
    "end": "18:00"
  },
  "timezone": "Asia/Tokyo"
}
```

Response:
```json
{
  "success": true,
  "timeRange": {
    "start": "2024-02-20",
    "end": "2024-02-21"
  },
  "timezone": "Asia/Tokyo",
  "freeSlots": [
    {
      "start": "2024-02-20T09:00:00+09:00",
      "end": "2024-02-20T18:00:00+09:00"
    }
  ]
}
```

### Buffer Time Format

You can add buffer times to meetings by adding a suffix to the event title:
- Format: `-B{minutes}A{minutes}`
- Example: "Meeting with Team -B15A10" (15 minutes before, 10 minutes after)

## Testing

Run the test script:
```bash
node test/test-free-slots.js
```

## Error Handling

The API returns appropriate error messages for:
- Invalid time zones
- Missing required parameters
- Authentication failures
- Calendar API errors

## Dependencies

- express
- googleapis
- luxon
- dotenv
- axios (for testing)

## License

MIT License
