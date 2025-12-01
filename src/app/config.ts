// --- APPLICATION CONFIGURATION ---
// Abstracted settings for Cloud Services and App Logic

export const AppConfig = {
  // Firebase Console -> Project Settings -> General -> Your Apps -> SDK Setup/Config
  firebase: {
	apiKey: "AIzaSyCtRIJNfTDdYJ4yQ4t2NK3IP2fZAs5O238",
	authDomain: "ld-debate-judge.firebaseapp.com",
	projectId: "ld-debate-judge",
	storageBucket: "ld-debate-judge.firebasestorage.app",
	messagingSenderId: "1031465191804",
	appId: "1:1031465191804:web:d80147a650f0cad4c77cf9",
	measurementId: "G-LY6JZCHPVZ"
  },
  
  // Feature Flags
  features: {
    enableOfflineMode: true, // Fallback to local simulation if config is invalid
    prepTimeSeconds: 240,    // 4 Minutes
    maxJudgesPerRound: 3
  }
};