import Link from 'next/link';
import { BookOpen, Zap, Package, Users, DollarSign, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const metadata = {
    title: 'Documentation - PricePilot',
    description: 'Learn how to use PricePilot to optimize your e-commerce pricing strategy',
};

const categories = [
    {
        title: 'Getting Started',
        description: 'Learn the basics and get up and running quickly',
        icon: BookOpen,
        slug: 'getting-started',
        color: 'text-blue-500',
    },
    {
        title: 'Products',
        description: 'Manage your product catalog and matching',
        icon: Package,
        slug: 'products',
        color: 'text-green-500',
    },
    {
        title: 'Competitors',
        description: 'Track competitor prices and configure scraping',
        icon: Users,
        slug: 'competitors',
        color: 'text-purple-500',
    },
    {
        title: 'Pricing',
        description: 'Automate price updates and strategies',
        icon: DollarSign,
        slug: 'pricing',
        color: 'text-yellow-500',
    },
    {
        title: 'Integrations',
        description: 'Connect OpenCart, Laravel, and other platforms',
        icon: Zap,
        slug: 'integrations',
        color: 'text-orange-500',
    },
    {
        title: 'Troubleshooting',
        description: 'Common issues and how to resolve them',
        icon: Wrench,
        slug: 'troubleshooting',
        color: 'text-red-500',
    },
];

export default function DocsHomePage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-12">
                <h1 className="mb-4 text-4xl font-bold tracking-tight">
                    Welcome to PricePilot Documentation
                </h1>
                <p className="text-lg text-muted-foreground">
                    Everything you need to know about using PricePilot to optimize your e-commerce pricing strategy.
                    Choose a category below to get started.
                </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => {
                    const Icon = category.icon;
                    return (
                        <Link key={category.slug} href={`/docs/${category.slug}`}>
                            <Card className="group h-full p-6 transition-all hover:border-primary hover:shadow-lg">
                                <div className="flex flex-col gap-4">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-muted ${category.color}`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="mb-2 text-xl font-semibold group-hover:text-primary transition-colors">
                                            {category.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {category.description}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            <div className="mt-12 rounded-lg border border-border bg-muted/50 p-6">
                <h2 className="mb-2 text-xl font-semibold">Need help?</h2>
                <p className="text-sm text-muted-foreground">
                    Can&apos;t find what you&apos;re looking for? Try using the search bar above or{' '}
                    <Link href="/dashboard/settings" className="text-primary hover:underline">
                        contact support
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
