TECHIEGER WEBSITE + ADMIN PANEL
===============================
Needs Node.js 18+ (free: nodejs.org). No npm install required.

RUN ON YOUR COMPUTER
  Windows (Command Prompt):  set ADMIN_PASSWORD=ChooseAStrongPassword && node server.js
  Mac/Linux:                 ADMIN_PASSWORD=ChooseAStrongPassword node server.js
  Website: http://localhost:3000        Admin panel: http://localhost:3000/admin

GO LIVE (so real customers can use it)
  Deploy this folder to any Node host (Render, Railway, a VPS, etc.).
  - Start command: node server.js
  - Set environment variable ADMIN_PASSWORD to a strong password.
  - IMPORTANT: attach a persistent disk/volume and set DATA_DIR to its path
    (e.g. /data). Without it, many hosts erase saved enquiries on restart.
  - Use HTTPS (hosts above provide it).

WHERE ARE THE CUSTOMERS?
  Every form submission is saved in data/inquiries.json (or DATA_DIR).
  In /admin you can search, filter, call/email, mark New/Contacted/Closed,
  add private notes, delete, and Export CSV (opens in Excel).
  Back up inquiries.json regularly.

FILES
  server.js          server + API (no dependencies)
  public/index.html  your website (WhatsApp contact removed, form -> admin panel)
  public/admin.html  admin panel
