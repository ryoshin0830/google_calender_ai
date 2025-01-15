# Google Calendar API

A RESTful API service that provides integration with Google Calendar, allowing you to manage events and find free time slots. The API is built with Node.js and Express, using the Google Calendar API for backend operations.

## Features

- Add events to Google Calendar
- List events from multiple calendars
- Delete events
- Find free time slots between events
- Timezone support using Luxon
- OAuth2 authentication

## Prerequisites

- Node.js (v14 or higher)
- Google Cloud Platform account
- OAuth2 credentials (client ID and client secret)
- Google Calendar API enabled in GCP Console

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables in `.env`:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri
API_KEYS=your_api_keys_comma_separated
```

## API Endpoints

### Health Check

Check if the API is running.

```http
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2025-01-10T16:17:25.072Z"
}
```

### Add Events

Add one or more events to Google Calendar.

```http
POST /api/events/add
```

Request body:
```json
{
  "events": [{
    "title": "Test Event",
    "description": "Event description",
    "start": "2025-01-11T02:00:00.000+09:00",
    "end": "2025-01-11T03:00:00.000+09:00",
    "timezone": "Asia/Tokyo"
  }],
  "timezone": "Asia/Tokyo"
}
```

Response:
```json
{
  "success": true,
  "timezone": "Asia/Tokyo",
  "results": [
    {
      "success": true,
      "eventId": "event_id",
      "title": "Test Event",
      "calendarId": "primary",
      "timezone": "Asia/Tokyo"
    }
  ]
}
```

### List Events

List events from all calendars within a specified time range.

```http
POST /api/events/list
```

Request body:
```json
{
  "days": 7,
  "timezone": "Asia/Tokyo"
}
```

Response:
```json
{
  "success": true,
  "timeRange": {
    "start": "2025-01-11T00:00:00.000+09:00",
    "end": "2025-01-18T23:59:59.999+09:00"
  },
  "timezone": "Asia/Tokyo",
  "count": 39,
  "events": [
    {
      "id": "event_id",
      "title": "Event Title",
      "calendar": "calendar_name",
      "calendarId": "calendar_id",
      "start": "2025-01-11T00:00:00.000+09:00",
      "end": "2025-01-11T10:00:00.000+09:00",
      "description": "Event description",
      "location": "Event location",
      "timezone": "Asia/Tokyo"
    }
  ]
}
```

### Delete Events

Delete one or more events from Google Calendar.

```http
POST /api/events/delete
```

Request body:
```json
{
  "events": [{
    "id": "event_id",
    "calendarId": "calendar_id"
  }]
}
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "eventId": "event_id"
    }
  ]
}
```

### Find Free Slots

Find available time slots between events.

```http
POST /api/events/free-slots
```

Request body:
```json
{
  "startDate": "2025-01-11",
  "endDate": "2025-01-12",
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
    "start": "2025-01-11",
    "end": "2025-01-12"
  },
  "timezone": "Asia/Tokyo",
  "freeSlots": [
    {
      "start": "2025-01-11T10:00:00+09:00",
      "end": "2025-01-11T13:30:00+09:00"
    }
  ]
}
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- 200: Success
- 400: Bad Request (invalid input)
- 401: Unauthorized (authentication required)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error

Error response format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

## Authentication

The API uses two levels of authentication:

1. OAuth2 for Google Calendar access
2. API Key for endpoint access control

### API Key Authentication

All API endpoints (except `/api/health`) require an API key to be included in the request headers:

```http
X-API-Key: your_api_key
```

API keys are configured through the `API_KEYS` environment variable as a comma-separated list. Multiple API keys can be specified to support different clients.

Example request with API key:
```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  http://your-api-url/api/events/list
```

### OAuth2 Authentication

The API uses OAuth2 for authentication with Google Calendar API. You need to:

1. Obtain OAuth2 credentials from Google Cloud Console
2. Set up environment variables with credentials
3. Implement OAuth2 flow in your application
4. Include authentication tokens in API requests

## Development

Start the development server:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

## Production

For production deployment:

1. Set up environment variables
2. Build the application:
```bash
npm run build
```
3. Start the server:
```bash
npm start
```

## License

MIT License
