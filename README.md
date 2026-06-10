# Pulse of Humanity

A beautiful, real-time web application where people can share and track their collective outlook on the future. Users can rate their mindset on an interactive, custom slider ranging from **Apocalyptic** to **Optimistic**, share their thoughts, and view real-time feed updates from around the world.

🚀 **Live Feed & Database Powered by Firebase Firestore**

---

## Features

- **Interactive Mood Slider**: A custom-styled range slider showing real-time text and emoji feedback depending on the selected sentiment (from *Apocalyptic* 🌋 to *Optimistic* ☀️).
- **Real-Time Live Feed**: Submissions are immediately sent to a Firebase Firestore database and synced in real time to all active users without page refreshes.
- **Collective Statistics**:
  - **World Mood score**: A dynamic indicator showing the average outlook of all users.
  - **Total pulses**: Tracking the number of voices sharing their outlook.
  - **Today's count**: Real-time counter of updates submitted today.
- **Secure Authentication**: Fully integrated Firestore-backed registration and sign-in. User profiles (with automatically assigned unique gradient avatars) are safely stored in the `users` database.
- **Premium UX/UI**: Designed with a sleek modern dark mode, fluid transitions, micro-animations, glassmorphic panels, and glowing custom sliders.

---

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern custom variables, custom range sliders, flexbox/grid layout), and JavaScript (ES6+).
- **Backend / Database**: Firebase Firestore (Compat SDK) for real-time data synchronization.

---

## Getting Started

### Prerequisites

To run this project locally, you just need a web browser. No local development server or compilation steps are required because it runs directly using the Firebase CDN.

### Installation & Run

1. Clone this repository:
   ```bash
   git clone https://github.com/senihakoksal/NYU-ITP.git
   cd NYU-ITP
   ```
2. Simply open `index.html` in your favorite web browser:
   ```bash
   # On macOS
   open index.html
   
   # On Windows / Linux
   # Double click index.html or open it via your browser
   ```

---

## Firestore Database Configuration

This application connects to the Firebase project **`nyu-itp-32868`**. 

If you are setting up your own database, update the `firebaseConfig` object inside `app.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Security Rules

Ensure your Firestore Security Rules allow read/write access to both `users` and `pulses` collections. You can use the following configuration in your Firebase Console:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if true;
    }
    match /pulses/{doc} {
      allow read, write: if true;
    }
  }
}
```

---

## License

This project was developed for NYU ITP. Feel free to use and modify it for educational purposes.
