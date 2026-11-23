<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('time_blocks', function (Blueprint $table) {
            $table->string('category', 50)->change();
        });

        Schema::table('blueprint_items', function (Blueprint $table) {
            $table->string('category', 50)->change();
        });
    }

    public function down(): void
    {
        Schema::table('time_blocks', function (Blueprint $table) {
            $table->enum('category', ['coding', 'kuliah', 'deep_work', 'istirahat'])->change();
        });

        Schema::table('blueprint_items', function (Blueprint $table) {
            $table->enum('category', ['coding', 'kuliah', 'deep_work', 'istirahat'])->change();
        });
    }
};
