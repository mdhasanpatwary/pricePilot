import { prisma } from "../lib/prisma";

async function checkRyans() {
  const site = await prisma.site.findFirst({
    where: { baseUrl: { contains: "ryans" } }
  });
  console.log("Site Data:", JSON.stringify(site, null, 2));
  process.exit(0);
}

checkRyans();
