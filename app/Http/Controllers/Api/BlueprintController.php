<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Blueprint\ApplyBlueprintRequest;
use App\Http\Requests\Blueprint\StoreBlueprintRequest;
use App\Models\RoutineBlueprint;
use App\Services\TimeBlockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BlueprintController extends Controller
{
    public function __construct(
        protected TimeBlockService $timeBlockService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $blueprints = RoutineBlueprint::with('items')
            ->where('user_id', $request->user()->id)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $blueprints,
        ]);
    }

    public function store(StoreBlueprintRequest $request): JsonResponse
    {
        $blueprint = DB::transaction(function () use ($request) {
            $user = $request->user();
            $bp = RoutineBlueprint::create([
                'user_id' => $user->id,
                'name' => $request->name,
                'description' => $request->description,
            ]);

            foreach ($request->items as $idx => $item) {
                $bp->items()->create([
                    'title' => $item['title'],
                    'category' => $item['category'],
                    'start_minute' => $item['start_minute'],
                    'duration_minutes' => $item['duration_minutes'],
                    'notes' => $item['notes'] ?? null,
                    'order_index' => $item['order_index'] ?? $idx,
                ]);
            }

            return $bp->load('items');
        });

        return response()->json([
            'success' => true,
            'data' => $blueprint,
        ], 201);
    }

    public function apply(ApplyBlueprintRequest $request): JsonResponse
    {
        $result = $this->timeBlockService->applyBlueprint(
            $request->user(),
            (int) $request->blueprint_id,
            $request->target_date,
            $request->boolean('overwrite')
        );

        return response()->json([
            'success' => true,
            'message' => 'Routine blueprint applied successfully.',
            'data' => $result,
        ]);
    }
}
