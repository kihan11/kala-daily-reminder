<?php

namespace Tests\Feature;

use App\Models\RoutineBlueprint;
use App\Models\TimeBlock;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class KalaApiTest extends TestCase
{
    use DatabaseTransactions;

    protected User $user;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::where('email', 'demo@kala.test')->first()
            ?? User::factory()->create([
                'email' => 'demo@kala.test',
                'password' => bcrypt('password'),
            ]);

        $this->token = $this->user->createToken('test_token')->plainTextToken;
    }

    public function test_demo_user_can_login_and_receive_token(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'demo@kala.test',
            'password' => 'password',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'token',
                    'user' => ['id', 'name', 'email'],
                ],
            ]);
    }

    public function test_auth_me_and_logout(): void
    {
        $meResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/auth/me');

        $meResponse->assertStatus(200)
            ->assertJsonPath('data.email', 'demo@kala.test');

        $logoutResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_time_block_creation_and_overlap_rejection(): void
    {
        $testDate = '2026-12-01';

        // 1. Create initial block: 09:00 - 10:30 (start: 540, dur: 90)
        $res1 = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/blocks', [
                'title' => 'Deep Focus Coding',
                'category' => 'coding',
                'scheduled_date' => $testDate,
                'start_minute' => 540,
                'duration_minutes' => 90,
            ]);

        $res1->assertStatus(201)
            ->assertJsonPath('data.start_minute', 540);

        // 2. Attempt overlapping block: 09:30 - 11:00 (start: 570, dur: 90) -> collision!
        $resOverlap = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/blocks', [
                'title' => 'Colliding Kuliah',
                'category' => 'kuliah',
                'scheduled_date' => $testDate,
                'start_minute' => 570,
                'duration_minutes' => 90,
            ]);

        $resOverlap->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['start_minute']]);

        // 3. Non-overlapping block: 10:30 - 12:00 (start: 630, dur: 90) -> success!
        $resValid = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/blocks', [
                'title' => 'Subsequent Meeting',
                'category' => 'deep_work',
                'scheduled_date' => $testDate,
                'start_minute' => 630,
                'duration_minutes' => 90,
            ]);

        $resValid->assertStatus(201);
    }

    public function test_auto_ripple_cascading_subsequent_blocks(): void
    {
        $testDate = '2026-12-02';

        // Block A: 500 - 560
        $blockA = TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Task A',
            'category' => 'coding',
            'scheduled_date' => $testDate,
            'start_minute' => 500,
            'duration_minutes' => 60,
        ]);

        // Block B: 560 - 620
        $blockB = TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Task B',
            'category' => 'kuliah',
            'scheduled_date' => $testDate,
            'start_minute' => 560,
            'duration_minutes' => 60,
        ]);

        // Block C: 620 - 680
        $blockC = TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Task C',
            'category' => 'deep_work',
            'scheduled_date' => $testDate,
            'start_minute' => 620,
            'duration_minutes' => 60,
        ]);

        // Extend Block A duration to 100 (500 -> 600) with auto_ripple: true
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/blocks/{$blockA->id}", [
                'duration_minutes' => 100,
                'auto_ripple' => true,
            ]);

        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        // Verify downstream shifts
        $this->assertEquals(600, $blockA->fresh()->end_minute);
        $this->assertEquals(600, $blockB->fresh()->start_minute);
        $this->assertEquals(660, $blockB->fresh()->end_minute);
        $this->assertEquals(660, $blockC->fresh()->start_minute);
        $this->assertEquals(720, $blockC->fresh()->end_minute);
    }

    public function test_auto_ripple_rejects_overflow_past_1440(): void
    {
        $testDate = '2026-12-03';

        // Block near midnight: 1400 - 1440
        $blockNearEnd = TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Late Review',
            'category' => 'deep_work',
            'scheduled_date' => $testDate,
            'start_minute' => 1400,
            'duration_minutes' => 40,
        ]);

        // Preceding block: 1360 - 1400
        $preceding = TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Preceding Task',
            'category' => 'coding',
            'scheduled_date' => $testDate,
            'start_minute' => 1360,
            'duration_minutes' => 40,
        ]);

        // Attempting to extend preceding to 1360..1420 will push Late Review to 1420..1460 (>1440)
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/blocks/{$preceding->id}", [
                'duration_minutes' => 60,
                'auto_ripple' => true,
            ]);

        $res->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['auto_ripple']]);
    }

    public function test_virtual_recurrence_projection_and_forking(): void
    {
        $startDate = '2026-11-23'; // Monday
        $endDate = '2026-11-29';   // Sunday

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson("/api/blocks?start_date={$startDate}&end_date={$endDate}");

        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        $blocks = $res->json('data');
        $this->assertNotEmpty($blocks);

        // Find a virtual block
        $virtualBlock = collect($blocks)->firstWhere('is_virtual', true);
        $this->assertNotNull($virtualBlock);
        $this->assertStringStartsWith('virtual_', (string) $virtualBlock['id']);

        // Fork the virtual block by modifying its title
        $forkRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/blocks/{$virtualBlock['id']}", [
                'title' => 'Forked Custom Lecture',
                'status' => 'completed',
            ]);

        $forkRes->assertStatus(200);

        // Re-fetch range: the date now contains persisted override
        $refetch = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson("/api/blocks?start_date={$startDate}&end_date={$endDate}");

        $updatedList = $refetch->json('data');
        $persistedOverride = collect($updatedList)->firstWhere('title', 'Forked Custom Lecture');
        $this->assertNotNull($persistedOverride);
        $this->assertFalse($persistedOverride['is_virtual']);
    }

    public function test_weekly_telemetry_metrics(): void
    {
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/telemetry/weekly?date=2026-11-22');

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'week_period' => ['start', 'end'],
                    'category_hours' => ['coding', 'kuliah', 'deep_work', 'istirahat'],
                    'total_logged_hours',
                    'execution_score',
                    'peak_focus_hour' => ['hour', 'time_label', 'total_focus_minutes'],
                ],
            ]);

        $score = $res->json('data.execution_score');
        $this->assertIsNumeric($score);
        $this->assertGreaterThanOrEqual(0, $score);
        $this->assertLessThanOrEqual(100, $score);
    }

    public function test_routine_blueprints_apply(): void
    {
        $blueprint = RoutineBlueprint::where('user_id', $this->user->id)->first();
        $this->assertNotNull($blueprint);

        $targetDate = '2026-12-10';

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/blueprints/apply', [
                'blueprint_id' => $blueprint->id,
                'target_date' => $targetDate,
                'overwrite' => true,
            ]);

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.date', $targetDate);

        $createdBlocks = TimeBlock::where('user_id', $this->user->id)
            ->where('scheduled_date', $targetDate)
            ->count();

        $this->assertEquals($blueprint->items()->count(), $createdBlocks);
    }

    public function test_clear_blocks_for_date(): void
    {
        $targetDate = '2026-11-25';

        TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Temporary Task 1',
            'category' => 'coding',
            'scheduled_date' => $targetDate,
            'start_minute' => 600,
            'duration_minutes' => 60,
            'status' => 'scheduled',
        ]);

        TimeBlock::create([
            'user_id' => $this->user->id,
            'title' => 'Temporary Task 2',
            'category' => 'kuliah',
            'scheduled_date' => $targetDate,
            'start_minute' => 660,
            'duration_minutes' => 60,
            'status' => 'scheduled',
        ]);

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->deleteJson("/api/blocks/clear?date={$targetDate}");

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('count', 2);

        $remaining = TimeBlock::where('user_id', $this->user->id)
            ->where('scheduled_date', $targetDate)
            ->count();

        $this->assertEquals(0, $remaining);
    }

    public function test_custom_category_and_flexible_duration(): void
    {
        $testDate = '2026-12-28';

        // 1. Create block with custom category and 25-minute duration
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/blocks', [
                'title' => 'Perancangan UI Circadian',
                'category' => 'Desain Sistem',
                'scheduled_date' => $testDate,
                'start_minute' => 480,
                'duration_minutes' => 25,
            ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.category', 'Desain Sistem')
            ->assertJsonPath('data.duration_minutes', 25);

        // 2. Update block to another custom category & duration
        $blockId = $res->json('data.id');
        $updateRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->patchJson("/api/blocks/{$blockId}", [
                'category' => 'Rapat Koordinasi',
                'duration_minutes' => 75,
            ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.updated_block.category', 'Rapat Koordinasi')
            ->assertJsonPath('data.updated_block.duration_minutes', 75);
    }

    public function test_duration_validation_boundaries(): void
    {
        $testDate = '2026-12-16';

        // Reject duration < 5
        $resUnder = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/blocks', [
                'title' => 'Too short',
                'category' => 'coding',
                'scheduled_date' => $testDate,
                'start_minute' => 500,
                'duration_minutes' => 4,
            ]);

        $resUnder->assertStatus(422)
            ->assertJsonStructure(['errors' => ['duration_minutes']]);

        // Reject duration > 720
        $resOver = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/blocks', [
                'title' => 'Too long',
                'category' => 'coding',
                'scheduled_date' => $testDate,
                'start_minute' => 500,
                'duration_minutes' => 721,
            ]);

        $resOver->assertStatus(422)
            ->assertJsonStructure(['errors' => ['duration_minutes']]);
    }
}
