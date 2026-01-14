<?php

namespace PricePilot\LaravelClient\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

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

        if (!$token || $token !== config('pricepilot.api_token')) {
            return response()->json(['error' => 'Unauthorized PricePilot request'], 401);
        }

        return $next($request);
    }
}
