<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlueprintItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'blueprint_id',
        'title',
        'category',
        'start_minute',
        'duration_minutes',
        'notes',
        'order_index',
    ];

    protected function casts(): array
    {
        return [
            'blueprint_id' => 'integer',
            'start_minute' => 'integer',
            'duration_minutes' => 'integer',
            'order_index' => 'integer',
        ];
    }

    public function blueprint(): BelongsTo
    {
        return $this->belongsTo(RoutineBlueprint::class, 'blueprint_id');
    }

    public function getEndMinuteAttribute(): int
    {
        return $this->start_minute + $this->duration_minutes;
    }
}
