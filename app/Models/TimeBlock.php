<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class TimeBlock extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'category',
        'scheduled_date',
        'start_minute',
        'duration_minutes',
        'status',
        'recurrence_days',
        'parent_block_id',
        'notes',
        'attachment_path',
        'attachment_name',
    ];

    protected $appends = [
        'attachment_url',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'scheduled_date' => 'date:Y-m-d',
            'start_minute' => 'integer',
            'duration_minutes' => 'integer',
            'recurrence_days' => 'array',
            'parent_block_id' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (TimeBlock $block) {
            if ($block->attachment_path && Storage::disk('public')->exists($block->attachment_path)) {
                Storage::disk('public')->delete($block->attachment_path);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parentBlock(): BelongsTo
    {
        return $this->belongsTo(TimeBlock::class, 'parent_block_id');
    }

    public function overrideBlocks(): HasMany
    {
        return $this->hasMany(TimeBlock::class, 'parent_block_id');
    }

    public function getEndMinuteAttribute(): int
    {
        return $this->start_minute + $this->duration_minutes;
    }

    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_path) {
            return null;
        }

        return Storage::disk('public')->url($this->attachment_path);
    }
}
