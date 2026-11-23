<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TimeBlock\StoreTimeBlockRequest;
use App\Http\Requests\TimeBlock\UpdateTimeBlockRequest;
use App\Models\TimeBlock;
use App\Services\TimeBlockService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeBlockController extends Controller
{
    public function __construct(
        protected TimeBlockService $timeBlockService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date', Carbon::now()->startOfWeek()->format('Y-m-d'));
        $endDate = $request->query('end_date', Carbon::now()->endOfWeek()->format('Y-m-d'));

        $blocks = $this->timeBlockService->getBlocksForDateRange(
            $request->user(),
            $startDate,
            $endDate
        );

        return response()->json([
            'success' => true,
            'data' => $blocks,
        ]);
    }

    public function store(StoreTimeBlockRequest $request): JsonResponse
    {
        $block = $this->timeBlockService->createBlock(
            $request->user(),
            $request->validated()
        );

        $data = $block->toArray();
        $data['is_virtual'] = false;

        return response()->json([
            'success' => true,
            'data' => $data,
        ], 201);
    }

    public function update(UpdateTimeBlockRequest $request, string $id): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $autoRipple = $request->boolean('auto_ripple');
        unset($data['auto_ripple']);

        // Fork virtual recurring instance if updating a virtual block
        if (str_starts_with($id, 'virtual_')) {
            $parts = explode('_', $id);
            // format: virtual_{parentId}_{date}
            $parentId = (int) $parts[1];
            $date = $parts[2];

            $parent = TimeBlock::where('user_id', $user->id)->findOrFail($parentId);

            $block = TimeBlock::create([
                'user_id' => $user->id,
                'title' => $data['title'] ?? $parent->title,
                'category' => $data['category'] ?? $parent->category,
                'scheduled_date' => $data['scheduled_date'] ?? $date,
                'start_minute' => $data['start_minute'] ?? $parent->start_minute,
                'duration_minutes' => $data['duration_minutes'] ?? $parent->duration_minutes,
                'status' => $data['status'] ?? 'scheduled',
                'recurrence_days' => null,
                'parent_block_id' => $parent->id,
                'notes' => $data['notes'] ?? $parent->notes,
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'updated_block' => $block,
                    'rippled_blocks' => [],
                ],
            ]);
        }

        $block = TimeBlock::where('user_id', $user->id)->findOrFail($id);
        $result = $this->timeBlockService->updateBlock($block, $data, $autoRipple);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        $date = $request->input('date') ?? $request->query('date');

        $request->merge(['date' => $date]);
        $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        $deletedCount = $this->timeBlockService->clearBlocksForDate(
            $request->user(),
            (string) $date
        );

        return response()->json([
            'success' => true,
            'message' => 'Time blocks cleared successfully.',
            'count' => $deletedCount,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (str_starts_with($id, 'virtual_')) {
            $parts = explode('_', $id);
            $parentId = (int) $parts[1];
            $date = $parts[2];

            $parent = TimeBlock::where('user_id', $user->id)->findOrFail($parentId);

            // Persist as skipped override so virtual generator omits it
            TimeBlock::create([
                'user_id' => $user->id,
                'title' => $parent->title,
                'category' => $parent->category,
                'scheduled_date' => $date,
                'start_minute' => $parent->start_minute,
                'duration_minutes' => $parent->duration_minutes,
                'status' => 'skipped',
                'parent_block_id' => $parent->id,
                'notes' => 'Deleted recurring instance',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Time block deleted successfully.',
            ]);
        }

        $block = TimeBlock::where('user_id', $user->id)->findOrFail($id);
        $block->delete();

        return response()->json([
            'success' => true,
            'message' => 'Time block deleted successfully.',
        ]);
    }
}
