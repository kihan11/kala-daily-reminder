<?php

namespace App\Http\Requests\Blueprint;

use Illuminate\Foundation\Http\FormRequest;

class StoreBlueprintRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.title' => ['required', 'string', 'max:255'],
            'items.*.category' => ['required', 'string', 'min:1', 'max:50'],
            'items.*.start_minute' => ['required', 'integer', 'between:0,1439'],
            'items.*.duration_minutes' => ['required', 'integer', 'between:5,720'],
            'items.*.notes' => ['nullable', 'string'],
            'items.*.order_index' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
