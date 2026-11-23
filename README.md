# Kala — Personal Daily Reminder

Kala is a web-based daily reminder and visual time-blocking planner built with Laravel and React. It helps organize daily routines across a 24-hour interactive timeline without relying on third-party external APIs.

## Features

- **24-Hour Interactive Timeline:** Click directly on any time slot to schedule an activity, drag blocks to reschedule, or resize durations with 15-minute snapping and overlap validation.
- **Auto-Ripple Rescheduling:** Automatically shifts subsequent blocks when an earlier schedule is extended or moved.
- **Quick Command Input (`Ctrl + K`):** Add schedules using text syntax (e.g., `09:00 - 10:30 Coding Laravel`) or apply saved daily blueprints.
- **Custom Categories & Flexible Durations:** Supports preset and custom user-defined categories, along with preset or manual minute durations.
- **Document Attachments:** Attach supporting files (PDF, Word, Excel) up to 10MB directly to any scheduled block using local storage.
- **Adaptive Circadian Themes:** Automatically switches color palettes based on the time of day (Morning, Afternoon, Evening, Night), with a manual Dark mode toggle.
- **Local Focus Tools:** Built-in live countdown bar, Zen focus overlay, and browser-synthesized ambient sounds (Brown Noise, Rain, Hum) using the Web Audio API.

## Tech Stack

- **Backend:** PHP 8.2+, Laravel 12, MySQL, Laravel Sanctum
- **Frontend:** React 19, Vite, Tailwind CSS, Axios, Lucide Icons

## Local Setup

### 1. Backend (Laravel)

```bash
composer install
cp .env.example .env
php artisan key:generate
```

Configure your MySQL database credentials inside `.env`, then run the migrations, seeders, and storage link:

```bash
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

### 2. Frontend (React + Vite)

Open a second terminal inside the `frontend` directory:

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL shown in your terminal (typically `http://localhost:5173`).

## Running Tests

```bash
php artisan test
```