<?php

namespace App\Http\Requests\TimeBlock;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTimeBlockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', 'string', 'min:1', 'max:50'],
            'scheduled_date' => ['sometimes', 'date_format:Y-m-d'],
            'start_minute' => ['sometimes', 'integer', 'between:0,1439'],
            'duration_minutes' => ['sometimes', 'integer', 'between:5,720'],
            'status' => ['sometimes', 'in:scheduled,completed,overtime,skipped'],
            'recurrence_days' => ['nullable', 'array'],
            'recurrence_days.*' => ['integer', 'between:1,7'],
            'parent_block_id' => ['nullable', 'integer', 'exists:time_blocks,id'],
            'notes' => ['nullable', 'string'],
            'auto_ripple' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            if ($this->has('start_minute') && $this->has('duration_minutes')) {
                $start = (int) $this->input('start_minute');
                $dur = (int) $this->input('duration_minutes');
                if ($start + $dur > 1440) {
                    $v->errors()->add('duration_minutes', 'Block end time cannot exceed 1440 minutes.');
                }
            }
        });
    }
}
