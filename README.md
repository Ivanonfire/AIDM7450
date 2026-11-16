# NightPulse HK / AIDM7450 Group F website

Tracking Hong Kong's Event Economy and Nighttime Culture.

This student project site stores events and visitor reviews in **MongoDB Atlas** when a connection string is provided, and automatically falls back to **local JSON files** so the site still runs for classroom / Moodle demos without Atlas.

本專題網站會在提供連線字串時使用 **MongoDB Atlas** 儲存活動與訪客評分；若未設定或連線失敗，會自動改用 **本機 JSON 檔**，方便課堂或 Moodle 示範。

## How to run / 如何啟動

```bash
npm install
npm start
```

Then open http://localhost:3000

首次啟動若活動資料庫／檔案是空的，系統會自動匯入 seed 資料。已有的評論**不會**在重啟時被清空。

## MongoDB Atlas setup / 設定 Atlas

1. 建立免費帳戶並開一個 **Free / M0 cluster**：https://www.mongodb.com/cloud/atlas  
2. 建立資料庫使用者（Database Access），並妥善保存密碼。  
3. 在 **Network Access** 加入你的 IP，或在課堂示範時短暫允許 `0.0.0.0/0`（僅限受控示範，用完請收緊）。  
4. 按 **Connect → Drivers** 複製連線字串（URI）。  
5. 複製 `.env.example` 為 `.env`（不要把 `.env` 交上 Moodle）：

```bash
cp .env.example .env
```

6. 把 URI 貼到 `MONGODB_URI=`。請把 `<password>` 換成真實密碼，並建議在路徑中指定資料庫名稱，例如 `...mongodb.net/nightpulse?retryWrites=true&w=majority`。  
7. 再執行 `npm start`。成功時終端機會顯示 `Database mode: mongo`。

Do **not** hard-code the URI or password in source files. `.env` is git-ignored and should be excluded from the submission zip.

請**不要**把連線字串或密碼寫進程式碼。`.env` 已列入 `.gitignore`，提交 zip 時也不應包含它。

## Local fallback / 本機後備

If `MONGODB_URI` is missing or MongoDB cannot be reached, the server uses:

- `data/events.json`
- `data/reviews.json`
- `data/venues.json`

The `data/` folder is created automatically on first fallback run. Reads, review POSTs, and first-run seeding all work in this mode. The terminal will print `Database mode: json-fallback`.

You can confirm the active mode at http://localhost:3000/api/status

若沒有 URI 或 Mongo 連不上，伺服器會改用上述 JSON 檔，讀取、提交評論與首次 seed 仍然可用。

## Demo: ratings and maps / 示範評分與地圖

1. 開啟 **What's Happening**（預設顯示 11 月活動）。  
2. 每張活動卡顯示場地／地址、平均星星、最近評論，以及 **Open in Google Maps** 連結（新分頁；只需普通搜尋網址，**不需要** Google Maps API key）。  
3. 在卡片上的 HTML 表單選 1–5 星、可選填暱稱、填寫評論後提交。成功後該活動的平均分與評論會即時更新。無需登入。  
4. 評論有長度限制（評論最多約 300 字）。前端會編碼輸出，避免 XSS。

## Seed data notes / 活動資料說明

- The seed includes the original prototype events plus year-round “spotlight” items, with addresses and Maps links added.  
- November 2026 is filled with publicly listed programmes (Wine & Dine ending 1 Nov, Gourmet Month, BODW, Asia+, Muse Fest, Asian Ethnic Cultural Performances+, WinterFest from 18 Nov).  
- **Clockenflap 2026** official dates are **4–6 December** (Central Harbourfront). The older prototype date of 27–29 November was corrected.  
- WinterFest is listed as the official citywide HKTB programme (from 18 Nov 2026), not the older prototype’s West Kowloon-only card.  
- Dollar figures such as `HK$450M` are **illustrative placeholders copied from the original prototype**, not official economic statistics. New events are marked `Not estimated`. The metrics bar does not add these figures into a fake city-wide total.  
- Dragon Boat 2027 is month-only; exact official race dates were not independently confirmed.  
- This is an independent student / community project, not an official HKTB website.

## Project structure / 資料夾

- `server.js` — Express app and API  
- `lib/store.js` — MongoDB driver + JSON fallback  
- `seed/` — event and venue seed data  
- `public/` — HTML, CSS, JS (Home, What's Happening, Night Culture, Economic Impact, Venues, and `index_tc.html`)

## API

- `GET /api/events?month=&category=&search=`  
- `GET /api/events/:id`  
- `GET /api/venues`  
- `GET /api/reviews?eventId=`  
- `POST /api/reviews` with JSON `{ "eventId", "stars", "comment", "nickname" }`  
- `GET /api/status`
