<?php

namespace Database\Seeders;

use App\Models\RoutineBlueprint;
use App\Models\TimeBlock;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $demoUser = User::create([
            'name' => 'Demo User',
            'email' => 'demo@kala.test',
            'password' => Hash::make('password'),
        ]);

        // Routine Blueprints
        $campusBlueprint = RoutineBlueprint::create([
            'user_id' => $demoUser->id,
            'name' => 'Weekday Campus Day',
            'description' => 'Standard university lecture morning followed by core development sprint.',
        ]);

        $campusBlueprint->items()->createMany([
            [
                'title' => 'Kuliah Teori & Praktikum',
                'category' => 'kuliah',
                'start_minute' => 480, // 08:00
                'duration_minutes' => 120, // 2h
                'notes' => 'Ruang 304 / Lab Komputer',
                'order_index' => 0,
            ],
            [
                'title' => 'Istirahat Siang & Sholat',
                'category' => 'istirahat',
                'start_minute' => 720, // 12:00
                'duration_minutes' => 60, // 1h
                'notes' => 'Makan siang & istirahat',
                'order_index' => 1,
            ],
            [
                'title' => 'Core Architecture Sprint',
                'category' => 'coding',
                'start_minute' => 810, // 13:30
                'duration_minutes' => 150, // 2.5h
                'notes' => 'Implementasi high-performance backend modules',
                'order_index' => 2,
            ],
            [
                'title' => 'Deep Work: System Design Review',
                'category' => 'deep_work',
                'start_minute' => 1140, // 19:00
                'duration_minutes' => 90, // 1.5h
                'notes' => 'Database indexing & query profile optimization',
                'order_index' => 3,
            ],
        ]);

        $weekendBlueprint = RoutineBlueprint::create([
            'user_id' => $demoUser->id,
            'name' => 'Weekend Deep Focus',
            'description' => 'Uninterrupted deep work blocks for hobby projects and research.',
        ]);

        $weekendBlueprint->items()->createMany([
            [
                'title' => 'Morning Open Source Contribution',
                'category' => 'coding',
                'start_minute' => 540, // 09:00
                'duration_minutes' => 180, // 3h
                'notes' => 'Refactoring & pull request reviews',
                'order_index' => 0,
            ],
            [
                'title' => 'Midday Recharge',
                'category' => 'istirahat',
                'start_minute' => 840, // 14:00
                'duration_minutes' => 90, // 1.5h
                'notes' => 'Walk & reading',
                'order_index' => 1,
            ],
            [
                'title' => 'Algorithmic Problem Solving',
                'category' => 'deep_work',
                'start_minute' => 1170, // 19:30
                'duration_minutes' => 120, // 2h
                'notes' => 'Graph theory & dynamic programming problems',
                'order_index' => 2,
            ],
        ]);

        // Anchor Date for Recurring Templates (e.g. 2 weeks ago Monday)
        $today = Carbon::today();
        $recurringAnchor = $today->copy()->subDays(14)->startOfWeek();

        // Virtual Recurring Templates
        TimeBlock::create([
            'user_id' => $demoUser->id,
            'title' => 'Kuliah: Algoritma & Struktur Data',
            'category' => 'kuliah',
            'scheduled_date' => $recurringAnchor->format('Y-m-d'),
            'start_minute' => 480, // 08:00
            'duration_minutes' => 100, // 08:00 - 09:40
            'status' => 'scheduled',
            'recurrence_days' => [1, 3], // Mon & Wed
            'notes' => 'Materi tree, heap, dan dynamic programming',
        ]);

        TimeBlock::create([
            'user_id' => $demoUser->id,
            'title' => 'Kuliah: Pemrograman Berorientasi Objek',
            'category' => 'kuliah',
            'scheduled_date' => $recurringAnchor->format('Y-m-d'),
            'start_minute' => 600, // 10:00
            'duration_minutes' => 100, // 10:00 - 11:40
            'status' => 'scheduled',
            'recurrence_days' => [2, 4], // Tue & Thu
            'notes' => 'Design pattern & SOLID principles',
        ]);

        TimeBlock::create([
            'user_id' => $demoUser->id,
            'title' => 'Deep Work: Core Engine Sprint',
            'category' => 'deep_work',
            'scheduled_date' => $recurringAnchor->format('Y-m-d'),
            'start_minute' => 780, // 13:00
            'duration_minutes' => 120, // 13:00 - 15:00
            'status' => 'scheduled',
            'recurrence_days' => [1, 2, 3, 4, 5], // Mon-Fri
            'notes' => 'Daily uninterrupted deep work block',
        ]);

        // Historical Data: Past 14 Days (14 days ago up to yesterday)
        for ($i = 14; $i >= 1; $i--) {
            $date = $today->copy()->subDays($i);
            $dateStr = $date->format('Y-m-d');
            $dayOfWeek = (int) $date->isoFormat('E'); // 1=Mon .. 7=Sun

            if ($dayOfWeek <= 5) {
                // Weekday
                // Block 1: Morning Kuliah / Deep Work
                TimeBlock::create([
                    'user_id' => $demoUser->id,
                    'title' => $dayOfWeek % 2 === 1 ? 'Kuliah Semester Lanjut' : 'Research & Literature Review',
                    'category' => $dayOfWeek % 2 === 1 ? 'kuliah' : 'deep_work',
                    'scheduled_date' => $dateStr,
                    'start_minute' => 480,
                    'duration_minutes' => 120,
                    'status' => $i === 3 ? 'overtime' : 'completed',
                    'notes' => 'Catatan sesi kuliah dan referensi',
                ]);

                // Block 2: Istirahat
                TimeBlock::create([
                    'user_id' => $demoUser->id,
                    'title' => 'Istirahat Siang & Lunch',
                    'category' => 'istirahat',
                    'scheduled_date' => $dateStr,
                    'start_minute' => 720,
                    'duration_minutes' => 60,
                    'status' => 'completed',
                ]);

                // Block 3: Afternoon Coding
                TimeBlock::create([
                    'user_id' => $demoUser->id,
                    'title' => 'Kala Feature Implementation',
                    'category' => 'coding',
                    'scheduled_date' => $dateStr,
                    'start_minute' => 840,
                    'duration_minutes' => 150,
                    'status' => $i === 7 ? 'skipped' : 'completed',
                    'notes' => 'Building core services and unit tests',
                ]);

                // Block 4: Evening Deep Work
                TimeBlock::create([
                    'user_id' => $demoUser->id,
                    'title' => 'Night Architecture & Refactor',
                    'category' => 'deep_work',
                    'scheduled_date' => $dateStr,
                    'start_minute' => 1170,
                    'duration_minutes' => 90,
                    'status' => 'completed',
                ]);
            } else {
                // Weekend
                TimeBlock::create([
                    'user_id' => $demoUser->id,
                    'title' => 'Weekend Project Hackathon',
                    'category' => 'coding',
                    'scheduled_date' => $dateStr,
                    'start_minute' => 570,
                    'duration_minutes' => 180,
                    'status' => 'completed',
                    'notes' => 'Frontend UI development and polishing',
                ]);

                TimeBlock::create([
                    'user_id' => $demoUser->id,
                    'title' => 'Santai Sore & Hobi',
                    'category' => 'istirahat',
                    'scheduled_date' => $dateStr,
                    'start_minute' => 900,
                    'duration_minutes' => 90,
                    'status' => 'completed',
                ]);

                TimeBlock::create([
                    'user_id' => $demoUser->id,
                    'title' => 'Weekend Review & Weekly Planning',
                    'category' => 'deep_work',
                    'scheduled_date' => $dateStr,
                    'start_minute' => 1200,
                    'duration_minutes' => 90,
                    'status' => $i === 1 ? 'overtime' : 'completed',
                ]);
            }
        }

        // Today's schedule (2026-11-22)
        $todayStr = $today->format('Y-m-d');
        TimeBlock::create([
            'user_id' => $demoUser->id,
            'title' => 'Backend API Testing & Verification',
            'category' => 'coding',
            'scheduled_date' => $todayStr,
            'start_minute' => 540, // 09:00
            'duration_minutes' => 150,
            'status' => 'completed',
            'notes' => 'Verify Sanctum, ripple shift, and telemetry APIs',
        ]);

        TimeBlock::create([
            'user_id' => $demoUser->id,
            'title' => 'Coffee Break & Walk',
            'category' => 'istirahat',
            'scheduled_date' => $todayStr,
            'start_minute' => 720,
            'duration_minutes' => 60,
            'status' => 'completed',
        ]);

        TimeBlock::create([
            'user_id' => $demoUser->id,
            'title' => 'Frontend Architecture Planning',
            'category' => 'deep_work',
            'scheduled_date' => $todayStr,
            'start_minute' => 840,
            'duration_minutes' => 120,
            'status' => 'scheduled',
            'notes' => 'Plan Obsidian dark UI and 1440-minute vertical canvas',
        ]);
    }
}
