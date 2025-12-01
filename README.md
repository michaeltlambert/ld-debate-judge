# DebateMate: Tournament Edition

## 📘 Project Overview
DebateMate is a real-time Lincoln-Douglas adjudication system.

### **New Features: Tournament Management**
* **Admin Portal:** Central hub to create, view, and manage all tournaments.
* **Auto-Codes:** Tournaments get a unique 6-digit code upon creation.
* **Multi-Admin:** Any admin can administer any open tournament.
* **Archive Mode:** Closed tournaments become read-only for historical review.

## 🔧 Configuration (Required)
To fix "auth/operation-not-allowed" or "auth/unauthorized-domain":

1.  Go to **Firebase Console > Authentication > Sign-in method**.
    * Click **Add new provider** -> **Google** -> Toggle **Enable** -> **Save**.
    * Click **Add new provider** -> **Facebook** -> Toggle **Enable** -> **Save**.
2.  Go to **Authentication > Settings > Authorized domains**.
    * Add `localhost` to the list.
3.  Update `src/app/config.ts` with your API Keys.

## 🚀 Getting Started
1.  **Install:** `npm install`
2.  **Run:** `npm start`
