/**
 * Mock Product Data for Testing
 * 
 * This file contains mock product data that was previously used as fallback
 * in production code. It's now only used for testing purposes.
 */

export interface MockProduct {
    external_id: string;
    sku: string | null;
    title: string;
    category?: string | null;
    price: number;
    brand: string | null;
    model: string | null;
    in_stock: boolean;
    image?: string;
    url: string | null;
}

/**
 * Mock OpenCart Products
 */
export const MOCK_OPENCART_PRODUCTS: MockProduct[] = [
    {
        external_id: "oc_1",
        sku: "NIKE-AM-270",
        title: "Nike Air Max 270",
        category: "Footwear",
        price: 150.0,
        brand: "Nike",
        model: "270",
        in_stock: true,
        image: "https://demo.opencart.com/image/nike-air-max-270.jpg",
        url: "https://demo.opencart.com/index.php?route=product/product&product_id=1",
    },
    {
        external_id: "oc_2",
        sku: "ADIDAS-UB-22",
        title: "Adidas Ultraboost 22",
        category: "Footwear",
        price: 180.0,
        brand: "Adidas",
        model: "22",
        in_stock: false,
        image: "https://demo.opencart.com/image/adidas-ultraboost-22.jpg",
        url: "https://demo.opencart.com/index.php?route=product/product&product_id=2",
    },
    {
        external_id: "oc_3",
        sku: "PUMA-SUEDE",
        title: "Puma Suede Classic",
        category: "Footwear",
        price: 75.0,
        brand: "Puma",
        model: "Suede Classic",
        in_stock: true,
        image: "https://demo.opencart.com/image/puma-suede.jpg",
        url: "https://demo.opencart.com/index.php?route=product/product&product_id=3",
    },
];

/**
 * Mock Laravel Products
 */
export const MOCK_LARAVEL_PRODUCTS: MockProduct[] = [
    {
        external_id: "lv_1",
        sku: "PUMA-RS-X",
        title: "Puma RS-X",
        category: "Footwear",
        price: 110.0,
        brand: "Puma",
        model: "RS-X",
        in_stock: true,
        image: "https://demo.laravel.com/images/puma-rs-x.jpg",
        url: "https://demo.laravel.com/products/puma-rs-x",
    },
    {
        external_id: "lv_2",
        sku: "NIKE-REACT",
        title: "Nike React Infinity Run",
        category: "Footwear",
        price: 160.0,
        brand: "Nike",
        model: "React Infinity",
        in_stock: true,
        image: "https://demo.laravel.com/images/nike-react.jpg",
        url: "https://demo.laravel.com/products/nike-react-infinity",
    },
];

/**
 * Mock Shopify Products
 */
export const MOCK_SHOPIFY_PRODUCTS: MockProduct[] = [
    {
        external_id: "sp_1",
        sku: "CONVERSE-CHUCK",
        title: "Converse Chuck Taylor All Star",
        category: "Footwear",
        price: 65.0,
        brand: "Converse",
        model: "Chuck Taylor",
        in_stock: true,
        image: "https://demo.shopify.com/images/converse-chuck.jpg",
        url: "https://demo.shopify.com/products/converse-chuck-taylor",
    },
];

/**
 * Mock WooCommerce Products
 */
export const MOCK_WOOCOMMERCE_PRODUCTS: MockProduct[] = [
    {
        external_id: "wc_1",
        sku: "VANS-OLD-SKOOL",
        title: "Vans Old Skool",
        category: "Footwear",
        price: 70.0,
        brand: "Vans",
        model: "Old Skool",
        in_stock: true,
        image: "https://demo.woocommerce.com/images/vans-old-skool.jpg",
        url: "https://demo.woocommerce.com/product/vans-old-skool",
    },
];

/**
 * Mock Magento Products
 */
export const MOCK_MAGENTO_PRODUCTS: MockProduct[] = [
    {
        external_id: "mg_1",
        sku: "REEBOK-CLASSIC",
        title: "Reebok Classic Leather",
        category: "Footwear",
        price: 80.0,
        brand: "Reebok",
        model: "Classic Leather",
        in_stock: true,
        image: "https://demo.magento.com/images/reebok-classic.jpg",
        url: "https://demo.magento.com/reebok-classic-leather.html",
    },
];

/**
 * Get mock products by platform
 */
export function getMockProductsByPlatform(platform: string): MockProduct[] {
    switch (platform.toUpperCase()) {
        case "OPENCART":
            return MOCK_OPENCART_PRODUCTS;
        case "LARAVEL":
            return MOCK_LARAVEL_PRODUCTS;
        case "SHOPIFY":
            return MOCK_SHOPIFY_PRODUCTS;
        case "WOOCOMMERCE":
            return MOCK_WOOCOMMERCE_PRODUCTS;
        case "MAGENTO":
            return MOCK_MAGENTO_PRODUCTS;
        default:
            return [];
    }
}
