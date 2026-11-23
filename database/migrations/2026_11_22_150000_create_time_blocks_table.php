<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->enum('category', ['coding', 'kuliah', 'deep_work', 'istirahat']);
            $table->date('scheduled_date');
            $table->unsignedSmallInteger('start_minute'); // 0 - 1439
            $table->unsignedSmallInteger('duration_minutes'); // 1 - 1440
            $table->enum('status', ['scheduled', 'completed', 'overtime', 'skipped'])->default('scheduled');
            $table->json('recurrence_days')->nullable(); // e.g. [1, 3, 5]
            $table->foreignId('parent_block_id')->nullable()->constrained('time_blocks')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'scheduled_date', 'start_minute'], 'idx_user_date_minute');
            $table->index(['user_id', 'parent_block_id'], 'idx_recurrence');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_blocks');
    }
};
