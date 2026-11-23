<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blueprint_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blueprint_id')->constrained('routine_blueprints')->cascadeOnDelete();
            $table->string('title');
            $table->enum('category', ['coding', 'kuliah', 'deep_work', 'istirahat']);
            $table->unsignedSmallInteger('start_minute'); // 0 - 1439
            $table->unsignedSmallInteger('duration_minutes'); // 1 - 1440
            $table->text('notes')->nullable();
            $table->unsignedSmallInteger('order_index')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blueprint_items');
    }
};
