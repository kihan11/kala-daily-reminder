<?php

namespace App\Http\Requests\TimeBlock;

use Illuminate\Foundation\Http\FormRequest;

class UploadAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'attachment' => 'required|file|max:10240|mimes:pdf,doc,docx,xls,xlsx,csv,txt',
        ];
    }

    public function messages(): array
    {
        return [
            'attachment.required' => 'Berkas lampiran wajib diunggah.',
            'attachment.file' => 'Lampiran harus berupa berkas yang valid.',
            'attachment.max' => 'Ukuran berkas lampiran maksimal 10MB.',
            'attachment.mimes' => 'Format berkas hanya boleh berupa PDF, Word, Excel, CSV, atau TXT.',
        ];
    }
}
