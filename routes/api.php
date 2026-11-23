<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BlueprintController;
use App\Http\Controllers\Api\TelemetryController;
use App\Http\Controllers\Api\TimeBlockAttachmentController;
use App\Http\Controllers\Api\TimeBlockController;
use Illuminate\Support\Facades\Route;

// Public Auth routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Protected Sanctum routes
Route::middleware('auth:sanctum')->group(function () {
    // User profile & session
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });

    // TimeBlocks CRUD & ripple
    Route::get('/blocks', [TimeBlockController::class, 'index']);
    Route::post('/blocks', [TimeBlockController::class, 'store']);
    Route::delete('/blocks/clear', [TimeBlockController::class, 'clear']);
    Route::patch('/blocks/{id}', [TimeBlockController::class, 'update']);
    Route::delete('/blocks/{id}', [TimeBlockController::class, 'destroy']);

    // Block Document Attachments
    Route::post('/blocks/{id}/attachment', [TimeBlockAttachmentController::class, 'store']);
    Route::get('/blocks/{id}/attachment', [TimeBlockAttachmentController::class, 'show']);
    Route::delete('/blocks/{id}/attachment', [TimeBlockAttachmentController::class, 'destroy']);

    // Routine Blueprints
    Route::get('/blueprints', [BlueprintController::class, 'index']);
    Route::post('/blueprints', [BlueprintController::class, 'store']);
    Route::post('/blueprints/apply', [BlueprintController::class, 'apply']);

    // Telemetry
    Route::get('/telemetry/weekly', [TelemetryController::class, 'weekly']);
});
