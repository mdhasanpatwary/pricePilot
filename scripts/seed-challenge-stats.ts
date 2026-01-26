import { prisma } from '../lib/prisma';

async function seedChallengeStats() {
    console.log('Seeding challenge attempt data...');

    const sites = [
        'example.com',
        'test-site.com',
        'demo-store.com',
        'sample-shop.com',
        'protected-site.com'
    ];

    const challengeTypes = [
        'cloudflare',
        'recaptcha',
        'turnstile',
        'perimeterx',
        'datadome'
    ];

    const now = new Date();
    const attempts = [];

    // Generate challenge attempts for the last 7 days
    for (let day = 0; day < 7; day++) {
        for (const site of sites) {
            const attemptsPerDay = Math.floor(Math.random() * 20) + 5; // 5-25 attempts per day per site

            for (let i = 0; i < attemptsPerDay; i++) {
                const timestamp = new Date(now);
                timestamp.setDate(now.getDate() - day);
                timestamp.setHours(Math.floor(Math.random() * 24));
                timestamp.setMinutes(Math.floor(Math.random() * 60));

                const challengeType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];

                // Vary solve rates by site to create interesting data
                let solveRate = 0.8; // Default 80% solve rate
                if (site === 'protected-site.com') {
                    solveRate = 0.5; // 50% solve rate for protected site
                } else if (site === 'demo-store.com') {
                    solveRate = 0.95; // 95% solve rate for demo store
                }

                const solved = Math.random() < solveRate;
                const duration = solved
                    ? Math.floor(Math.random() * 5000) + 1000 // 1-6 seconds for solved
                    : Math.floor(Math.random() * 20000) + 10000; // 10-30 seconds for failed

                attempts.push({
                    site,
                    challengeType,
                    solved,
                    duration,
                    timestamp
                });
            }
        }
    }

    // Insert all attempts
    console.log(`Creating ${attempts.length} challenge attempts...`);

    for (const attempt of attempts) {
        await prisma.challengeAttempt.create({
            data: attempt
        });
    }

    console.log('✅ Challenge attempt data seeded successfully!');

    // Print summary
    const stats = await prisma.challengeAttempt.groupBy({
        by: ['site'],
        _count: {
            id: true
        },
        _sum: {
            duration: true
        }
    });

    console.log('\nSummary by site:');
    for (const stat of stats) {
        console.log(`  ${stat.site}: ${stat._count.id} attempts`);
    }
}

seedChallengeStats()
    .catch((error) => {
        console.error('Error seeding challenge stats:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
