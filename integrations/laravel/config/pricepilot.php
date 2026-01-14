<?php

return [
    /*
    |--------------------------------------------------------------------------
    | PricePilot API Token
    |--------------------------------------------------------------------------
    |
    | This token is used to authorize requests from the PricePilot SaaS
    | dashboard. Keep this token secret.
    |
    */
    'api_token' => env('PRICEPILOT_API_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | Route Prefix
    |--------------------------------------------------------------------------
    |
    | The route prefix used for the PricePilot API endpoints.
    |
    */
    'route_prefix' => 'api/pricepilot',
];
