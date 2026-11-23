<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TimeBlock\UploadAttachmentRequest;
use App\Models\TimeBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimeBlockAttachmentController extends Controller
{
    public function store(UploadAttachmentRequest $request, string $id): JsonResponse
    {
        $user = $request->user();

        if (str_starts_with($id, 'virtual_')) {
            $parts = explode('_', $id);
            $parentId = (int) $parts[1];
            $date = $parts[2];

            $parent = TimeBlock::where('user_id', $user->id)->findOrFail($parentId);

            $block = TimeBlock::create([
                'user_id' => $user->id,
                'title' => $parent->title,
                'category' => $parent->category,
                'scheduled_date' => $date,
                'start_minute' => $parent->start_minute,
                'duration_minutes' => $parent->duration_minutes,
                'status' => 'scheduled',
                'recurrence_days' => null,
                'parent_block_id' => $parent->id,
                'notes' => $parent->notes,
            ]);
        } else {
            $block = TimeBlock::where('user_id', $user->id)->findOrFail($id);
        }

        $file = $request->file('attachment');
        $originalName = $file->getClientOriginalName();

        if ($block->attachment_path && Storage::disk('public')->exists($block->attachment_path)) {
            Storage::disk('public')->delete($block->attachment_path);
        }

        $path = $file->store('attachments', 'public');

        $block->update([
            'attachment_path' => $path,
            'attachment_name' => $originalName,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lampiran berhasil diunggah.',
            'data' => $block->fresh(),
        ]);
    }

    public function show(Request $request, string $id): StreamedResponse|JsonResponse
    {
        $user = $request->user();
        $block = TimeBlock::where('user_id', $user->id)->findOrFail($id);

        if (!$block->attachment_path || !Storage::disk('public')->exists($block->attachment_path)) {
            return response()->json([
                'success' => false,
                'message' => 'Berkas lampiran tidak ditemukan.',
            ], 404);
        }

        $downloadName = $block->attachment_name ?: basename($block->attachment_path);

        return Storage::disk('public')->download($block->attachment_path, $downloadName);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $block = TimeBlock::where('user_id', $user->id)->findOrFail($id);

        if ($block->attachment_path && Storage::disk('public')->exists($block->attachment_path)) {
            Storage::disk('public')->delete($block->attachment_path);
        }

        $block->update([
            'attachment_path' => null,
            'attachment_name' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lampiran berhasil dihapus.',
            'data' => $block->fresh(),
        ]);
    }
}
