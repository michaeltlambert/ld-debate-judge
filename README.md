# DebateMate: Tournament Edition

## 📘 Project Overview
DebateMate is a real-time Lincoln-Douglas adjudication system. It allows multiple independent tournaments to run simultaneously using unique **Tournament IDs**.

### **Roles**
1.  **Tournament Admin:** Creates a tournament, gets a unique **Code**, matches debaters, and finalizes rounds.
2.  **Judge:** Enters the Tournament Code to join the pool, receives assignments, and submits ballots.
3.  **Debater:** Enters the Tournament Code, views pairings, and tracks their record.

### **Tech Stack**
* **Framework:** Angular v21 (Signals)
* **Backend:** Firebase Firestore (Filtered Queries)
* **Styling:** Tailwind CSS v4

## 🚀 Getting Started
1.  **Install:** `npm install`
2.  **Run:** `npm start`
3.  **Workflow:**
    * **Admin:** Select "Create Tournament" on login. Share the **6-character Code** displayed in the dashboard.
    * **Participants:** Enter Name, Role, and the **Code** to join.
