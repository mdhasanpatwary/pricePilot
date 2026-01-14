<?php

use Illuminate\Support\Facades\Route;
use PricePilot\LaravelClient\Http\Controllers\PricePilotController;

Route::get('/sync', [PricePilotController::class, 'sync']);
Route::post('/update', [PricePilotController::class, 'update']);
