<?php

namespace App\Http\Requests\Blueprint;

use Illuminate\Foundation\Http\FormRequest;

class ApplyBlueprintRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'blueprint_id' => ['required', 'integer', 'exists:routine_blueprints,id'],
            'target_date' => ['required', 'date_format:Y-m-d'],
            'overwrite' => ['sometimes', 'boolean'],
        ];
    }
}
