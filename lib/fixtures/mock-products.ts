/**
 * Mock product data for development and testing purposes
 * Only used when USE_MOCK_DATA=true environment variable is set
 */

export const MOCK_OPENCART_PRODUCTS = [
    {
        product_id: "1",
        name: "Sample Product 1",
        sku: "MOCK-001",
        price: "99.99",
        brand: "Mock Brand",
        model: "Model-X",
        image: "https://via.placeholder.com/150",
    },
    {
        product_id: "2",
        name: "Sample Product 2",
        sku: "MOCK-002",
        price: "149.99",
        brand: "Mock Brand",
        model: "Model-Y",
        image: "https://via.placeholder.com/150",
    },
];

export const MOCK_LARAVEL_PRODUCTS = [
    {
        id: "1",
        name: "Sample Laravel Product 1",
        sku: "MOCK-L-001",
        price: 99.99,
        brand: "Mock Brand",
        model: "Model-A",
        image_url: "https://via.placeholder.com/150",
    },
    {
        id: "2",
        name: "Sample Laravel Product 2",
        sku: "MOCK-L-002",
        price: 149.99,
        brand: "Mock Brand",
        model: "Model-B",
        image_url: "https://via.placeholder.com/150",
    },
];
