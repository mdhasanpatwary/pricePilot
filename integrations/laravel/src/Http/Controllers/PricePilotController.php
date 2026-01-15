<?php

namespace PricePilot\LaravelClient\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PricePilotController extends Controller
{
    /**
     * Sync products to PricePilot.
     *
     * This endpoint fetches your product catalog and returns it to PricePilot.
     * Customize the query to match your database structure.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function sync(Request $request)
    {
        try {
            $limit = $request->get('limit', 100);
            $page = $request->get('page', 1);

            // Validate pagination parameters
            if ($limit > 500) {
                $limit = 500; // Max 500 products per request
            }

            // Get table name from config or use default
            $table = config('pricepilot.products_table', 'products');

            // Get column mappings from config
            $columns = config('pricepilot.column_mapping', [
                'id' => 'id',
                'name' => 'name',
                'sku' => 'sku',
                'price' => 'price',
                'brand' => 'brand',
                'model' => 'model',
            ]);

            // Build the query
            $query = DB::table($table)
                ->select(array_values($columns));

            // Apply filters if configured
            if ($activeColumn = config('pricepilot.active_column')) {
                $query->where($activeColumn, true);
            }

            // Get paginated results
            $products = $query->paginate($limit, ['*'], 'page', $page);

            // Transform the response to use standard field names
            $transformedData = collect($products->items())->map(function ($product) use ($columns) {
                $transformed = [];
                foreach ($columns as $standardName => $dbColumn) {
                    $transformed[$standardName] = $product->{$dbColumn} ?? null;
                }
                return $transformed;
            });

            Log::info('PricePilot: Synced products', [
                'count' => $transformedData->count(),
                'page' => $page,
                'total' => $products->total()
            ]);

            return response()->json([
                'data' => $transformedData,
                'current_page' => $products->currentPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'last_page' => $products->lastPage(),
            ]);

        } catch (\Exception $e) {
            Log::error('PricePilot: Sync failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to sync products',
                'message' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Update product price from PricePilot.
     *
     * This endpoint receives price updates from PricePilot and applies them to your store.
     * Add your custom logic here (e.g., logging, events, cache clearing).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request)
    {
        try {
            // Validate request
            $validated = $request->validate([
                'product_id' => 'required',
                'price' => 'required|numeric|min:0',
            ]);

            $productId = $validated['product_id'];
            $newPrice = $validated['price'];

            // Get table and column names from config
            $table = config('pricepilot.products_table', 'products');
            $priceColumn = config('pricepilot.column_mapping.price', 'price');
            $idColumn = config('pricepilot.column_mapping.id', 'id');

            // Get current product
            $product = DB::table($table)
                ->where($idColumn, $productId)
                ->first();

            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found'
                ], 404);
            }

            $oldPrice = $product->{$priceColumn};

            // Check if price actually changed
            if ((float) $oldPrice === (float) $newPrice) {
                return response()->json([
                    'success' => true,
                    'message' => 'Price unchanged',
                    'old_price' => $oldPrice,
                    'new_price' => $newPrice,
                ]);
            }

            // Update the price
            $updated = DB::table($table)
                ->where($idColumn, $productId)
                ->update([
                    $priceColumn => $newPrice,
                    'updated_at' => now(),
                ]);

            if ($updated) {
                Log::info('PricePilot: Price updated', [
                    'product_id' => $productId,
                    'old_price' => $oldPrice,
                    'new_price' => $newPrice,
                ]);

                // Fire event if configured
                if (class_exists('App\Events\ProductPriceUpdated')) {
                    event(new \App\Events\ProductPriceUpdated($productId, $oldPrice, $newPrice));
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Price updated successfully',
                    'product_id' => $productId,
                    'old_price' => $oldPrice,
                    'new_price' => $newPrice,
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to update price'
            ], 500);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            Log::error('PricePilot: Price update failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update price',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Health check endpoint.
     *
     * Verifies that the integration is working correctly.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function health()
    {
        try {
            $table = config('pricepilot.products_table', 'products');
            $count = DB::table($table)->count();

            return response()->json([
                'status' => 'ok',
                'message' => 'PricePilot integration is working',
                'products_count' => $count,
                'version' => '1.0.0',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Database connection failed',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }
}
