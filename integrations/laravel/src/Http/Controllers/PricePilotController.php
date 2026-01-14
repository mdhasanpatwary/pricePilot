<?php

namespace PricePilot\LaravelClient\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class PricePilotController extends Controller
{
    public function sync(Request $request)
    {
        // Example: Fetching basic product data
        $products = DB::table('products')
            ->select('id', 'name', 'sku', 'price', 'brand', 'model')
            ->paginate($request->get('limit', 100));

        return response()->json($products);
    }

    public function update(Request $request)
    {
        $request->validate([
            'product_id' => 'required',
            'price' => 'required|numeric|min:0',
        ]);

        $updated = DB::table('products')
            ->where('id', $request->product_id)
            ->update([
                'price' => $request->price,
                'updated_at' => now(),
            ]);

        if ($updated) {
            return response()->json(['success' => true, 'message' => 'Price updated in Laravel store']);
        }

        return response()->json(['success' => false, 'message' => 'Product not found or update failed'], 404);
    }
}
