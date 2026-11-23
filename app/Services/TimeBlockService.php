<?php

namespace App\Services;

use App\Models\RoutineBlueprint;
use App\Models\TimeBlock;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TimeBlockService
{
    /**
     * Check if a given time interval overlaps with any existing persistent block.
     * Interval rule: existing_start < new_end AND (existing_start + duration) > new_start
     */
    public function checkOverlap(
        int $userId,
        string $date,
        int $startMinute,
        int $durationMinutes,
        ?int $excludeBlockId = null
    ): ?TimeBlock {
        $newEnd = $startMinute + $durationMinutes;

        return TimeBlock::where('user_id', $userId)
            ->where('scheduled_date', $date)
            ->when($excludeBlockId, fn ($q) => $q->where('id', '!=', $excludeBlockId))
            ->where(function ($q) use ($startMinute, $newEnd) {
                $q->where('start_minute', '<', $newEnd)
                  ->whereRaw('(start_minute + duration_minutes) > ?', [$startMinute]);
            })
            ->first();
    }

    /**
     * Create a new persistent time block with overlap validation.
     */
    public function createBlock(User $user, array $data): TimeBlock
    {
        $start = (int) $data['start_minute'];
        $dur = (int) $data['duration_minutes'];
        $date = $data['scheduled_date'];

        $overlap = $this->checkOverlap($user->id, $date, $start, $dur);
        if ($overlap) {
            throw ValidationException::withMessages([
                'start_minute' => ["Time block overlaps with existing block '{$overlap->title}' [{$overlap->start_minute} - {$overlap->end_minute}]."],
            ]);
        }

        $data['user_id'] = $user->id;

        return TimeBlock::create($data);
    }

    /**
     * Update an existing time block.
     * If auto_ripple is false and overlap occurs, throws a ValidationException.
     * If auto_ripple is true, pushes subsequent colliding blocks downstream sequentially.
     */
    public function updateBlock(TimeBlock $block, array $data, bool $autoRipple = false): array
    {
        $targetDate = $data['scheduled_date'] ?? $block->scheduled_date->format('Y-m-d');
        $newStart = isset($data['start_minute']) ? (int) $data['start_minute'] : $block->start_minute;
        $newDur = isset($data['duration_minutes']) ? (int) $data['duration_minutes'] : $block->duration_minutes;

        if ($newStart + $newDur > 1440) {
            throw ValidationException::withMessages([
                'duration_minutes' => ['Target block interval exceeds 24:00 (1440 minutes).'],
            ]);
        }

        if (!$autoRipple) {
            $overlap = $this->checkOverlap($block->user_id, $targetDate, $newStart, $newDur, $block->id);
            if ($overlap) {
                throw ValidationException::withMessages([
                    'start_minute' => ["Collision detected with '{$overlap->title}'. Enable auto_ripple to push subsequent blocks."],
                ]);
            }

            $block->update($data);

            return [
                'updated_block' => $block->fresh(),
                'rippled_blocks' => [],
            ];
        }

        return DB::transaction(function () use ($block, $data, $targetDate, $newStart, $newDur) {
            $block->update($data);

            $currentEnd = $newStart + $newDur;
            $rippledBlocks = [];
            $visited = [$block->id => true];

            while (true) {
                $colliding = TimeBlock::where('user_id', $block->user_id)
                    ->where('scheduled_date', $targetDate)
                    ->whereNotIn('id', array_keys($visited))
                    ->where('start_minute', '<', $currentEnd)
                    ->whereRaw('(start_minute + duration_minutes) > ?', [$newStart])
                    ->orderBy('start_minute', 'asc')
                    ->first();

                if (!$colliding) {
                    break;
                }

                $visited[$colliding->id] = true;
                $shiftStart = $currentEnd;
                $shiftEnd = $shiftStart + $colliding->duration_minutes;

                if ($shiftEnd > 1440) {
                    throw ValidationException::withMessages([
                        'auto_ripple' => ["Auto-ripple shift pushes block '{$colliding->title}' beyond 24:00 (1440 minutes). Operation rejected."],
                    ]);
                }

                $colliding->start_minute = $shiftStart;
                $colliding->save();

                $rippledBlocks[] = [
                    'id' => $colliding->id,
                    'title' => $colliding->title,
                    'start_minute' => $colliding->start_minute,
                    'duration_minutes' => $colliding->duration_minutes,
                ];

                $currentEnd = $shiftEnd;
            }

            return [
                'updated_block' => $block->fresh(),
                'rippled_blocks' => $rippledBlocks,
            ];
        });
    }

    /**
     * Retrieve all persisted and virtual recurring blocks projected across a calendar date range.
     */
    public function getBlocksForDateRange(User $user, string $startDate, string $endDate): Collection
    {
        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->endOfDay();

        $persisted = TimeBlock::where('user_id', $user->id)
            ->whereBetween('scheduled_date', [$startDate, $endDate])
            ->get();

        $existingOverrides = [];
        foreach ($persisted as $p) {
            $dateStr = $p->scheduled_date->format('Y-m-d');
            if ($p->parent_block_id) {
                $existingOverrides["{$p->parent_block_id}_{$dateStr}"] = true;
            }
            if ($p->recurrence_days) {
                $existingOverrides["{$p->id}_{$dateStr}"] = true;
            }
        }

        $templates = TimeBlock::where('user_id', $user->id)
            ->whereNull('parent_block_id')
            ->whereNotNull('recurrence_days')
            ->where('scheduled_date', '<=', $endDate)
            ->get();

        $virtual = collect();
        $period = CarbonPeriod::create($start, $end);

        foreach ($period as $date) {
            $dateStr = $date->format('Y-m-d');
            $isoDay = (int) $date->isoFormat('E');

            foreach ($templates as $tmpl) {
                if ($date->lt($tmpl->scheduled_date)) {
                    continue;
                }

                $days = $tmpl->recurrence_days ?? [];
                if (!in_array($isoDay, $days)) {
                    continue;
                }

                $key = "{$tmpl->id}_{$dateStr}";
                if (isset($existingOverrides[$key])) {
                    continue;
                }

                $virtual->push([
                    'id' => "virtual_{$tmpl->id}_{$dateStr}",
                    'user_id' => $user->id,
                    'title' => $tmpl->title,
                    'category' => $tmpl->category,
                    'scheduled_date' => $dateStr,
                    'start_minute' => $tmpl->start_minute,
                    'duration_minutes' => $tmpl->duration_minutes,
                    'status' => 'scheduled',
                    'recurrence_days' => $tmpl->recurrence_days,
                    'parent_block_id' => $tmpl->id,
                    'is_virtual' => true,
                    'notes' => $tmpl->notes,
                    'attachment_path' => null,
                    'attachment_name' => null,
                    'attachment_url' => null,
                    'created_at' => $tmpl->created_at?->toISOString(),
                    'updated_at' => $tmpl->updated_at?->toISOString(),
                ]);
            }
        }

        $persistedFormatted = $persisted->map(function ($block) {
            $arr = $block->toArray();
            $arr['is_virtual'] = false;
            return $arr;
        });

        return $persistedFormatted->concat($virtual)->sort(function ($a, $b) {
            if ($a['scheduled_date'] === $b['scheduled_date']) {
                return $a['start_minute'] <=> $b['start_minute'];
            }
            return strcmp($a['scheduled_date'], $b['scheduled_date']);
        })->values();
    }

    public function clearBlocksForDate(User $user, string $date): int
    {
        return TimeBlock::where('user_id', $user->id)
            ->where('scheduled_date', $date)
            ->whereNull('recurrence_days')
            ->delete();
    }

    /**
     * Calculate weekly telemetry including category hours, execution score, and peak focus hour.
     */
    public function calculateWeeklyTelemetry(User $user, ?string $referenceDate = null): array
    {
        $ref = $referenceDate ? Carbon::parse($referenceDate) : Carbon::now();
        $weekStart = $ref->copy()->startOfWeek();
        $weekEnd = $ref->copy()->endOfWeek();

        $startDate = $weekStart->format('Y-m-d');
        $endDate = $weekEnd->format('Y-m-d');

        $blocks = $this->getBlocksForDateRange($user, $startDate, $endDate);

        $categories = [
            'coding' => 0.0,
            'kuliah' => 0.0,
            'deep_work' => 0.0,
            'istirahat' => 0.0,
            'rapat' => 0.0,
            'pribadi' => 0.0,
        ];

        $completedCount = 0;
        $denominatorCount = 0;
        $hourBins = array_fill(0, 24, 0);

        foreach ($blocks as $block) {
            $cat = $block['category'];
            $dur = (int) $block['duration_minutes'];
            $status = $block['status'];
            $startMinute = (int) $block['start_minute'];

            if (!isset($categories[$cat])) {
                $categories[$cat] = 0.0;
            }
            $categories[$cat] += round($dur / 60, 2);

            if ($status === 'completed') {
                $completedCount++;
                $denominatorCount++;

                // Track peak focus minutes for coding and deep_work
                if (in_array($cat, ['coding', 'deep_work'])) {
                    $bStart = $startMinute;
                    $bEnd = $startMinute + $dur;

                    for ($h = 0; $h < 24; $h++) {
                        $hStart = $h * 60;
                        $hEnd = ($h + 1) * 60;

                        $overlap = min($bEnd, $hEnd) - max($bStart, $hStart);
                        if ($overlap > 0) {
                            $hourBins[$h] += $overlap;
                        }
                    }
                }
            } elseif (in_array($status, ['overtime', 'skipped'])) {
                $denominatorCount++;
            }
        }

        $executionScore = $denominatorCount > 0
            ? round(($completedCount / $denominatorCount) * 100, 1)
            : 100.0;

        $peakHour = 0;
        $maxMinutes = -1;
        foreach ($hourBins as $h => $mins) {
            if ($mins > $maxMinutes) {
                $maxMinutes = $mins;
                $peakHour = $h;
            }
        }

        $startLabel = str_pad($peakHour, 2, '0', STR_PAD_LEFT) . ':00';
        $endLabel = str_pad($peakHour + 1, 2, '0', STR_PAD_LEFT) . ':00';

        return [
            'week_period' => [
                'start' => $startDate,
                'end' => $endDate,
            ],
            'category_hours' => $categories,
            'total_logged_hours' => round(array_sum($categories), 2),
            'execution_score' => $executionScore,
            'peak_focus_hour' => [
                'hour' => $peakHour,
                'time_label' => "{$startLabel} - {$endLabel}",
                'total_focus_minutes' => max(0, $maxMinutes),
            ],
        ];
    }

    /**
     * Apply a saved routine blueprint to a target date.
     */
    public function applyBlueprint(User $user, int $blueprintId, string $targetDate, bool $overwrite = false): array
    {
        $blueprint = RoutineBlueprint::with('items')
            ->where('user_id', $user->id)
            ->findOrFail($blueprintId);

        return DB::transaction(function () use ($user, $blueprint, $targetDate, $overwrite) {
            if ($overwrite) {
                TimeBlock::where('user_id', $user->id)
                    ->where('scheduled_date', $targetDate)
                    ->delete();
            }

            $createdCount = 0;
            foreach ($blueprint->items as $item) {
                if (!$overwrite) {
                    $overlap = $this->checkOverlap($user->id, $targetDate, $item->start_minute, $item->duration_minutes);
                    if ($overlap) {
                        throw ValidationException::withMessages([
                            'target_date' => ["Cannot apply blueprint item '{$item->title}': collides with '{$overlap->title}' on {$targetDate}."],
                        ]);
                    }
                }

                TimeBlock::create([
                    'user_id' => $user->id,
                    'title' => $item->title,
                    'category' => $item->category,
                    'scheduled_date' => $targetDate,
                    'start_minute' => $item->start_minute,
                    'duration_minutes' => $item->duration_minutes,
                    'status' => 'scheduled',
                    'notes' => $item->notes,
                ]);

                $createdCount++;
            }

            return [
                'created_count' => $createdCount,
                'date' => $targetDate,
            ];
        });
    }
}
