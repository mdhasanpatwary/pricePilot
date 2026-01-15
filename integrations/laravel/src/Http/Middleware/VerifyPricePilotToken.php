<?php

namespace PricePilot\LaravelClient\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VerifyPricePilotToken
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $token = $request->header('X-PricePilot-Token');
        $configToken = config('pricepilot.api_token');

        // Check if token is configured
        if (!$configToken) {
            if (config('pricepilot.enable_logging')) {
                Log::error('PricePilot: API token not configured in .env file');
            }

            return response()->json([
                'error' => 'PricePilot integration not configured',
                'message' => 'Please set PRICEPILOT_API_TOKEN in your .env file'
            ], 500);
        }

        // Verify token
        if (!$token || $token !== $configToken) {
            if (config('pricepilot.enable_logging')) {
                Log::warning('PricePilot: Unauthorized request attempt', [
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'path' => $request->path(),
                ]);
            }

            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'Invalid or missing PricePilot API token'
            ], 401);
        }

        // Log successful authentication
        if (config('pricepilot.enable_logging')) {
            Log::info('PricePilot: Authenticated request', [
                'path' => $request->path(),
                'method' => $request->method(),
            ]);
        }

        return $next($request);
    }
}
