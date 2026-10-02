const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if database has already been seeded or has data
  const existingSeedSetting = await prisma.setting.findUnique({
    where: { key: 'db_seeded' },
  });
  const taskCount = await prisma.task.count();

  if (existingSeedSetting || taskCount > 0) {
    console.log('Database already initialized with data. Skipping seed to prevent duplicate entries.');
    return;
  }

  console.log('Seeding initial Life OS database...');

  // 1. Domains
  const domainHome = await prisma.domain.upsert({
    where: { slug: 'home' },
    update: {},
    create: {
      name: 'Life / Home',
      slug: 'home',
      color: '#4A6B82',
      order: 1,
    },
  });

  const domainWork = await prisma.domain.upsert({
    where: { slug: 'work' },
    update: {},
    create: {
      name: 'Black Diamond Services',
      slug: 'work',
      color: '#B34636',
      order: 2,
    },
  });

  const domainGlacier = await prisma.domain.upsert({
    where: { slug: 'glacier' },
    update: {},
    create: {
      name: 'Glacier Precast Concrete',
      slug: 'glacier',
      color: '#8A5D3B',
      order: 3,
    },
  });

  const domainContent = await prisma.domain.upsert({
    where: { slug: 'content' },
    update: {},
    create: {
      name: 'Content & Media',
      slug: 'content',
      color: '#9C6F44',
      order: 4,
    },
  });

  // 2. Projects
  const projectGads = await prisma.project.create({
    data: {
      title: 'Missoula Google Ads Campaign',
      type: 'RETAINER',
      status: 'ACTIVE',
      domainId: domainGlacier.id,
      monthlyBudgetHours: 20,
      hoursLogged: 12.5,
    },
  });

  const projectBDS = await prisma.project.create({
    data: {
      title: 'Setup Review Request System',
      type: 'MILESTONE',
      status: 'ACTIVE',
      domainId: domainWork.id,
    },
  });

  // 3. Top 3 Tasks (Matching Screenshot!)
  await prisma.task.create({
    data: {
      title: 'Missoula Google Ads',
      status: 'TODO',
      priority: 'TOP_3',
      isTop3: true,
      dueDate: new Date(),
      domainId: domainGlacier.id,
      projectId: projectGads.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Setup Review Request System',
      status: 'TODO',
      priority: 'TOP_3',
      isTop3: true,
      dueDate: new Date(),
      domainId: domainWork.id,
      projectId: projectBDS.id,
    },
  });

  // 4. All Open Tasks (Matching Screenshot!)
  const openTasksData = [
    {
      title: 'Check Oil Ford Ranger',
      status: 'TODO',
      domainId: domainHome.id,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Overdue 3d
      isRecurring: true,
      recurrenceRule: 'MONTHLY',
    },
    {
      title: 'Audit Ads Performance',
      status: 'TODO',
      domainId: domainWork.id,
      dueDate: new Date(),
    },
    {
      title: 'Next Door Post',
      status: 'TODO',
      domainId: domainWork.id,
      dueDate: new Date(),
      isRecurring: true,
      recurrenceRule: 'WEEKLY',
    },
    {
      title: 'Schedule BDS Social Posts',
      status: 'TODO',
      domainId: domainWork.id,
      dueDate: new Date(),
      isRecurring: true,
      recurrenceRule: 'WEEKLY',
    },
    {
      title: 'WordPress Plugin Review Topics',
      status: 'TODO',
      domainId: domainContent.id,
      dueDate: new Date(),
    },
    {
      title: 'New article topics',
      status: 'TODO',
      domainId: domainWork.id,
      dueDate: new Date(),
    },
    {
      title: 'Invoice Corwin & Sarah Wedding',
      status: 'TODO',
      domainId: domainWork.id,
      dueDate: new Date(),
    },
  ];

  for (const t of openTasksData) {
    await prisma.task.create({ data: t });
  }

  // 5. Up Next Calendar Events (Matching Screenshot!)
  const scheduleEventsData = [
    {
      title: 'Jerad and Sam Josephson',
      startTime: '2:30 PM',
      date: new Date(),
      location: 'Office / Call',
    },
    {
      title: 'Mal Dinner',
      startTime: 'Fri 7:00 PM',
      date: new Date(),
      location: 'Montana Prime Steakhouse',
    },
    {
      title: 'Church',
      startTime: 'Sun 11:00 AM',
      date: new Date(),
      location: 'Easthaven Baptist Church, 2010 Whitefish Stage Rd, Kalispell, MT',
    },
    {
      title: 'Table Group',
      startTime: 'Mon 6:00 AM',
      date: new Date(),
      location: 'Black Rifle Coffee Company, 305 Second Ave W, Kalispell, MT',
    },
  ];

  for (const ev of scheduleEventsData) {
    await prisma.scheduleEvent.create({ data: ev });
  }

  // 6. Routines (Morning, Afternoon, Evening with Streaks matching screenshot!)
  const todayStr = new Date().toISOString().split('T')[0];

  const r1 = await prisma.routine.create({
    data: {
      title: 'Morning Medicine / Supplements',
      icon: '💊',
      timeOfDay: 'MORNING',
      streak: 5,
      bestStreak: 12,
      lastCompletedDate: todayStr,
    },
  });
  await prisma.routineLog.create({
    data: { routineId: r1.id, date: todayStr, completed: true },
  });

  await prisma.routine.create({
    data: {
      title: 'Start Journal Entry',
      icon: '📝',
      timeOfDay: 'MORNING',
      streak: 4,
      bestStreak: 14,
    },
  });

  const r3 = await prisma.routine.create({
    data: {
      title: 'Check Email',
      icon: '✉️',
      timeOfDay: 'MORNING',
      streak: 5,
      bestStreak: 20,
      lastCompletedDate: todayStr,
    },
  });
  await prisma.routineLog.create({
    data: { routineId: r3.id, date: todayStr, completed: true },
  });

  const r4 = await prisma.routine.create({
    data: {
      title: "Listen to God's Word",
      icon: '🎧',
      timeOfDay: 'MORNING',
      streak: 5,
      bestStreak: 30,
      lastCompletedDate: todayStr,
    },
  });
  await prisma.routineLog.create({
    data: { routineId: r4.id, date: todayStr, completed: true },
  });

  const r5 = await prisma.routine.create({
    data: {
      title: 'Vitamins',
      icon: '🌿',
      timeOfDay: 'AFTERNOON',
      streak: 5,
      bestStreak: 15,
      lastCompletedDate: todayStr,
    },
  });
  await prisma.routineLog.create({
    data: { routineId: r5.id, date: todayStr, completed: true },
  });

  const r6 = await prisma.routine.create({
    data: {
      title: 'Check Email',
      icon: '✉️',
      timeOfDay: 'AFTERNOON',
      streak: 5,
      bestStreak: 20,
      lastCompletedDate: todayStr,
    },
  });
  await prisma.routineLog.create({
    data: { routineId: r6.id, date: todayStr, completed: true },
  });

  await prisma.routine.create({
    data: {
      title: 'Close Out Daily Journal Page',
      icon: '📖',
      timeOfDay: 'EVENING',
      streak: 4,
      bestStreak: 10,
    },
  });

  await prisma.routine.create({
    data: {
      title: 'Write Daily Bible Chapter',
      icon: '✍️',
      timeOfDay: 'EVENING',
      streak: 4,
      bestStreak: 25,
    },
  });

  // 7. Resurfacing Library Quote
  await prisma.libraryItem.create({
    data: {
      title: 'Wisdom on deliberate focus',
      body: 'Do not let the noise of others opinions drown out your own inner voice. Have the courage to follow your heart and intuition.',
      author: 'Steve Jobs',
      type: 'QUOTE',
    },
  });

  // 8. Inbox Triage Items (Matching Screenshot!)
  await prisma.inboxItem.create({
    data: {
      title: 'A guide for youtube and website.',
      rawContent: 'A guide for youtube and website. A detailed course for the website.',
      status: 'NEEDS_REVIEW',
      source: 'QUICK_CAPTURE',
    },
  });

  await prisma.inboxItem.create({
    data: {
      title: 'As a 45-year-old self-employed father and Christian with a public pres...',
      rawContent: 'Reflections on intentional fatherhood, business stewardship and faith.',
      status: 'NEEDS_REVIEW',
      source: 'QUICK_CAPTURE',
    },
  });

  // 9. System Notification
  await prisma.systemNotification.create({
    data: {
      title: 'Task created',
      message: 'Task created: Check oil on car',
      type: 'TASK_CREATED',
      read: false,
    },
  });

  // 10. Record that database has been seeded
  await prisma.setting.upsert({
    where: { key: 'db_seeded' },
    update: { value: 'true' },
    create: { key: 'db_seeded', value: 'true' },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
