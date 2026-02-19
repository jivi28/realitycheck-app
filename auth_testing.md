# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
db.projects.insertMany([
  {project_id: 'proj_default01', user_id: userId, name: 'Deep Work', color: '#00FF41', is_default: true, created_at: new Date().toISOString()},
  {project_id: 'proj_study01', user_id: userId, name: 'Study', color: '#00CC33', is_default: false, created_at: new Date().toISOString()},
  {project_id: 'proj_coding01', user_id: userId, name: 'Coding', color: '#33FF66', is_default: false, created_at: new Date().toISOString()}
]);
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Test auth
curl -X GET "$API_URL/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test projects
curl -X GET "$API_URL/api/projects" -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test timer start
curl -X POST "$API_URL/api/timer/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"description": "Test task", "project_id": "proj_default01"}'

# Test timer stop
curl -X POST "$API_URL/api/timer/stop" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test entries
curl -X GET "$API_URL/api/entries" -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test analytics
curl -X GET "$API_URL/api/analytics/daily" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "$API_URL/api/analytics/weekly" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com/dashboard");
```
