<?php

namespace Tests\Feature;

use App\Models\TimeBlock;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TimeBlockAttachmentTest extends TestCase
{
    use DatabaseTransactions;

    protected User $user;
    protected string $token;
    protected TimeBlock $block;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->user = User::where('email', 'demo@kala.test')->first()
            ?? User::factory()->create([
                'email' => 'demo@kala.test',
                'password' => bcrypt('password'),
            ]);

        $this->token = $this->user->createToken('test_attachment_token')->plainTextToken;

        $this->block = TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Kuliah Sistem Terdistribusi',
            'category' => 'kuliah',
            'scheduled_date' => '2026-11-23',
            'start_minute' => 600,
            'duration_minutes' => 90,
            'status' => 'scheduled',
            'notes' => 'Materi Bab 4 Konsensus',
        ]);
    }

    public function test_can_upload_pdf_attachment_to_time_block(): void
    {
        $file = UploadedFile::fake()->create('materi_kuliah.pdf', 1024, 'application/pdf');

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.attachment_name', 'materi_kuliah.pdf');

        $this->block->refresh();
        $this->assertNotNull($this->block->attachment_path);
        $this->assertEquals('materi_kuliah.pdf', $this->block->attachment_name);
        Storage::disk('public')->assertExists($this->block->attachment_path);
    }

    public function test_rejects_disallowed_file_extensions(): void
    {
        $file = UploadedFile::fake()->create('script.exe', 500, 'application/x-msdownload');

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['attachment']);
    }

    public function test_rejects_file_exceeding_10mb(): void
    {
        // 11MB file (11264 KB)
        $file = UploadedFile::fake()->create('huge_dataset.xlsx', 11264, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['attachment']);
    }

    public function test_replacing_attachment_deletes_old_file_from_storage(): void
    {
        $file1 = UploadedFile::fake()->create('old_slides.pdf', 500, 'application/pdf');

        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file1,
            ]);

        $this->block->refresh();
        $oldPath = $this->block->attachment_path;
        Storage::disk('public')->assertExists($oldPath);

        // Upload replacement
        $file2 = UploadedFile::fake()->create('new_slides.docx', 800, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file2,
            ]);

        $this->block->refresh();
        $this->assertNotEquals($oldPath, $this->block->attachment_path);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($this->block->attachment_path);
        $this->assertEquals('new_slides.docx', $this->block->attachment_name);
    }

    public function test_can_download_attachment_with_auth(): void
    {
        $file = UploadedFile::fake()->create('modul_praktikum.pdf', 200, 'application/pdf');

        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file,
            ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->get("/api/blocks/{$this->block->id}/attachment");

        $response->assertStatus(200)
            ->assertHeader('content-disposition');
    }

    public function test_can_delete_attachment_from_storage_and_database(): void
    {
        $file = UploadedFile::fake()->create('tugas.xlsx', 300, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file,
            ]);

        $this->block->refresh();
        $path = $this->block->attachment_path;
        Storage::disk('public')->assertExists($path);

        $deleteResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->deleteJson("/api/blocks/{$this->block->id}/attachment");

        $deleteResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->block->refresh();
        $this->assertNull($this->block->attachment_path);
        $this->assertNull($this->block->attachment_name);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_cannot_access_or_modify_other_users_attachment(): void
    {
        $otherUser = User::factory()->create([
            'email' => 'other@kala.test',
            'password' => bcrypt('password'),
        ]);
        $otherToken = $otherUser->createToken('other_token')->plainTextToken;

        $file = UploadedFile::fake()->create('secret.pdf', 100, 'application/pdf');

        $response = $this->withHeader('Authorization', "Bearer {$otherToken}")
            ->postJson("/api/blocks/{$this->block->id}/attachment", [
                'attachment' => $file,
            ]);

        $response->assertStatus(404);
    }
}
