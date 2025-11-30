# DebateMate: Tournament Edition

## 📘 Project Overview
DebateMate is a real-time Lincoln-Douglas adjudication system. It features a tri-role interface:
1.  **Administrator:** Matches debaters, assigns judges, and tracks tournament standings (Wins/Losses).
2.  **Judge:** Receives assignments, times rounds, flows arguments, and submits ballots.
3.  **Debater:** Logs in to register for the tournament and view their own record.

### **Tech Stack**
* **Framework:** Angular v21 (Signals Architecture)
* **Backend:** Firebase Firestore (Real-time Sync) & Auth (Anonymous)
* **Styling:** Tailwind CSS v4
* **Export:** PDF Generation (`html-to-image`)

---

## 🏗 Data Architecture (Firestore)

### **Collections**
All data is stored under strict paths for security: `/artifacts/{appId}/public/data/{collection}`.

1.  **`judges`** & **`debaters`** (Profiles)
    * `id`: UID
    * `name`: Display Name
    * `isOnline`: Boolean status

2.  **`debates`**
    * `topic`: "Resolved: ..."
    * `affId` / `negId`: UIDs of the debaters
    * `affName` / `negName`: Cached names for display
    * `judgeIds`: Array of judge UIDs
    * `status`: 'Open' | 'Closed'

3.  **`results`** (Submitted Ballots)
    * `debateId`: Link to Debate
    * `judgeId`: Link to Judge
    * `decision`: 'Aff' | 'Neg' (Used to calculate W/L)

---

## 🚀 Getting Started
1.  **Install:** `npm install`
2.  **Run:** `npm start`
3.  **Login:** * **Debaters:** Log in first so your name appears in the Admin's list.
    * **Admin:** Log in to see the "Registered Debaters" list and create matches.
