# Competition Admin Dashboard

React admin dashboard for the photo competition platform. Manage prediction parlay settings, monitor user activity, and process withdrawal requests.

---

## 📱 Overview

This dashboard gives administrators full control over the photo competition business. It's where I adjust the prediction parlay accuracy rates and house edge (which determine coin payouts), manage player cash withdrawals, and monitor overall platform activity.

---

## 🛠️ Tech Stack

- **React** – Frontend
- **Firebase** – Auth, Firestore, Cloud Functions
- **Recharts** – Analytics visualisation

---

## ✨ Key Features

- **Parlay settings management** – Adjust star accuracy rates and house edge to control coin payouts
- **Withdrawal processing** – View, approve, and manage player cash withdrawal requests
- **User management** – Monitor users, view activity, and manage accounts
- **Analytics dashboard** – Track platform performance, user growth, and revenue

---

## 🏗️ Architecture

Built on a **Firebase-first** backend:

- **Firestore** – Stores user data, withdrawal requests, and platform settings
- **Cloud Functions** – Serverless logic for withdrawal processing and payout calculations
- **Firebase Auth** – Admin authentication and authorisation
- **Recharts** – Data visualisation for analytics

---

## 📸 Screenshots

| Dashboard |
|-----------|
| <img width="300" alt="Dashboard" src="https://github.com/user-attachments/assets/19e31d44-620c-4f8f-8306-2d9553a88558" /> |

---

## 🔗 Related Repos

- [Photo Competition iOS App](https://github.com/chisom123/photo-competition-ios) – The main app where users compete and earn points
- [Affiliate Marketing Platform](https://github.com/chisom123/affiliate-marketing-platform) – Admin dashboard for the affiliate program
- [Affiliate Partner iOS App](https://github.com/chisom123/affiliate-partner-ios) – iOS app for affiliates to manage their campaigns

---

## ⚙️ Setup

This project uses Firebase. To run it locally:

1. Clone the repo  
2. Create a Firebase project and enable Auth, Firestore, and Cloud Functions  
3. Add your Firebase config to the environment variables  
4. Run `npm install` and `npm start`

---

## 📈 Evolution

Built as the administrative backbone of the photo competition platform. This dashboard gave me full control over the business logic—from adjusting prediction accuracy rates to processing real money withdrawals—without needing to touch the app code.
