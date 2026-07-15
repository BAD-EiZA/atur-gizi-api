const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.activityType
  .count()
  .then((c) => {
    console.log('activity_types', c);
    return p.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await p.$disconnect();
    process.exit(1);
  });
