# Google Calendar AI API

API Base URL: https://google-calender-ai.vercel.app

## API Endpoints

### 1. List Events
Lists calendar events for a specified time range.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"days": 7}' \
  https://google-calender-ai.vercel.app/api/events/list
```

Response:
```json
{
  "success": true,
  "timeRange": {
    "start": "2025-01-10T00:00:00.000Z",
    "end": "2025-01-17T00:00:00.000Z"
  },
  "count": 30,
  "events": [
    {
      "id": "event_id",
      "title": "Event Title",
      "calendar": "Calendar Name",
      "calendarId": "calendar_id",
      "start": "2025-01-10T00:00:00+09:00",
      "end": "2025-01-10T10:00:00+09:00",
      "description": null,
      "location": null
    }
  ]
}
```

### 2. Get Free Time Slots
Returns available time slots considering events from calendars named 'main' and 'block'.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-15",
    "endDate": "2025-01-16",
    "workingHours": {
      "start": "09:00",
      "end": "18:00"
    },
    "timezone": "Asia/Tokyo"
  }' \
  https://google-calender-ai.vercel.app/api/events/free-slots
```

Parameters:
- `startDate`: Start date in YYYY-MM-DD format (required)
- `endDate`: End date in YYYY-MM-DD format (required)
- `workingHours`: Working hours object (optional)
  - `start`: Start time in HH:mm format (default: "09:00")
  - `end`: End time in HH:mm format (default: "18:00")
- `timezone`: IANA timezone string (optional, default: "Asia/Tokyo")

Response:
```json
{
  "success": true,
  "timeRange": {
    "start": "2025-01-15",
    "end": "2025-01-16"
  },
  "timezone": "Asia/Tokyo",
  "freeSlots": [
    {
      "start": "2025-01-15T09:00:00+09:00",
      "end": "2025-01-15T12:00:00+09:00"
    },
    {
      "start": "2025-01-15T15:00:00+09:00",
      "end": "2025-01-15T18:00:00+09:00"
    }
  ]
}
```

### 3. Add Event
Creates a new calendar event.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "title": "Test Event",
      "description": "This is a test event",
      "start": "2025-01-15T14:00:00+09:00",
      "end": "2025-01-15T15:00:00+09:00"
    }]
  }' \
  https://google-calender-ai.vercel.app/api/events/add
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "eventId": "hu3rj6ale62b549b8qf11rfe4s",
      "title": "Test Event",
      "calendarId": "primary"
    }
  ]
}
```

### 4. Delete Event
Deletes a calendar event.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "id": "hu3rj6ale62b549b8qf11rfe4s",
      "calendarId": "primary"
    }]
  }' \
  https://google-calender-ai.vercel.app/api/events/delete
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "eventId": "hu3rj6ale62b549b8qf11rfe4s"
    }
  ]
}
```
