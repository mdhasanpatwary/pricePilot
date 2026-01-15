<?php

namespace PricePilot\LaravelClient\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Str;

class InstallCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pricepilot:install';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Install PricePilot Laravel integration';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('Installing PricePilot Laravel Integration...');
        $this->newLine();

        // Publish configuration
        $this->call('vendor:publish', [
            '--provider' => 'PricePilot\LaravelClient\PricePilotServiceProvider',
            '--tag' => 'config'
        ]);

        // Generate API token if not exists
        if (!env('PRICEPILOT_API_TOKEN')) {
            $token = Str::random(64);
            $this->addEnvironmentVariable('PRICEPILOT_API_TOKEN', $token);

            $this->newLine();
            $this->info('✓ Generated secure API token');
            $this->line('  Token: ' . $token);
            $this->newLine();
            $this->warn('⚠ IMPORTANT: Copy this token to your PricePilot dashboard!');
            $this->warn('  You can find it in your .env file as PRICEPILOT_API_TOKEN');
        } else {
            $this->info('✓ API token already exists in .env');
        }

        $this->newLine();
        $this->info('✓ Configuration published to config/pricepilot.php');

        $this->newLine();
        $this->line('Next steps:');
        $this->line('1. Copy your PRICEPILOT_API_TOKEN from .env');
        $this->line('2. Go to PricePilot Dashboard → Integrations');
        $this->line('3. Select Laravel and enter your store URL');
        $this->line('4. Paste the API token and click "Verify & Connect"');

        $this->newLine();
        $this->info('Installation complete! 🚀');

        return 0;
    }

    /**
     * Add or update an environment variable.
     *
     * @param string $key
     * @param string $value
     * @return void
     */
    protected function addEnvironmentVariable($key, $value)
    {
        $envPath = base_path('.env');

        if (!file_exists($envPath)) {
            return;
        }

        $envContent = file_get_contents($envPath);

        // Check if key already exists
        if (preg_match("/^{$key}=/m", $envContent)) {
            // Update existing key
            $envContent = preg_replace(
                "/^{$key}=.*/m",
                "{$key}={$value}",
                $envContent
            );
        } else {
            // Add new key
            $envContent .= "\n{$key}={$value}\n";
        }

        file_put_contents($envPath, $envContent);
    }
}
