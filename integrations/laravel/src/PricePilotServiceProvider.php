<?php

namespace PricePilot\LaravelClient;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Route;

class PricePilotServiceProvider extends ServiceProvider
{
    public function boot()
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../config/pricepilot.php' => config_path('pricepilot.php'),
            ], 'config');
        }

        $this->registerRoutes();
    }

    public function register()
    {
        $this->mergeConfigFrom(__DIR__.'/../config/pricepilot.php', 'pricepilot');
    }

    protected function registerRoutes()
    {
        Route::group([
            'prefix' => config('pricepilot.route_prefix', 'api/pricepilot'),
            'middleware' => ['api', \PricePilot\LaravelClient\Http\Middleware\VerifyPricePilotToken::class],
        ], function () {
            $this->loadRoutesFrom(__DIR__.'/../routes/api.php');
        });
    }
}
