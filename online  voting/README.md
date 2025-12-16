# Online Voting Demo (local)

This is a small demo web application for a local online voting system with two roles: admin and voter. It's intentionally simple and uses MongoDB for persistence. Not for production.

Features
- Admin: add candidates, create and schedule an election, start/stop, publish results
- Voter: register (with voter number), login, view schedule, verify voter number, and cast one vote while the election is active

Quick start (Windows PowerShell)

1) Ensure you have Node.js installed (LTS recommended). Check with:

```powershell
node -v
npm -v
```

2) Set up MongoDB

You can run a local MongoDB server or use MongoDB Atlas. If running locally the default connection used by the app is:

```
mongodb://127.0.0.1:27017/voting-demo
```

To use a custom URI, create a `.env` file in the project root with:

```
MONGO_URI=your-mongodb-uri
SESSION_SECRET=some-secret
```

3) Install packages

```powershell
npm install
```

4) Start the app

```powershell
npm start
```

Open http://localhost:3000 in your browser.

Default admin account
- username: admin
- password: admin123

Notes
- This is a demo only: passwords are hashed but there is no email verification, CSRF protection, or production security hardening.
