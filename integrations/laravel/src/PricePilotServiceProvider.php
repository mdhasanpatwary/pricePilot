<?php

namespace PricePilot\LaravelClient;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Route;
use PricePilot\LaravelClient\Console\InstallCommand;

class PricePilotServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        if ($this->app->runningInConsole()) {
            // Publish configuration
            $this->publishes([
                __DIR__.'/../config/pricepilot.php' => config_path('pricepilot.php'),
            ], 'pricepilot-config');

            // Register commands
            $this->commands([
                InstallCommand::class,
            ]);
        }

        $this->registerRoutes();
    }

    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        $this->mergeConfigFrom(__DIR__.'/../config/pricepilot.php', 'pricepilot');
    }

    /**
     * Register the package routes.
     *
     * @return void
     */
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
