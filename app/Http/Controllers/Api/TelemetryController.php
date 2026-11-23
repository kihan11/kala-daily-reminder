<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TimeBlockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelemetryController extends Controller
{
    public function __construct(
        protected TimeBlockService $timeBlockService
    ) {}

    public function weekly(Request $request): JsonResponse
    {
        $date = $request->query('date');
        $telemetry = $this->timeBlockService->calculateWeeklyTelemetry(
            $request->user(),
            $date
        );

        return response()->json([
            'success' => true,
            'data' => $telemetry,
        ]);
    }
}
