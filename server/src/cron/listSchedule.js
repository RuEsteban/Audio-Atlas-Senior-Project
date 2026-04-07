import qstash from '../config/qstashClient.js';

/**
 * 
 * Helper functions in cron development and testing
 * 
 */

async function listSchedules() {
  const schedules = await qstash.schedules.list();
  console.log(JSON.stringify(schedules, null, 2));
}

/*
async function deleteSchedule(scheduleId) {
  await qstash.schedules.delete(scheduleId);
  console.log("Deleted schedule:", scheduleId);
}
*/

listSchedules();
// deleteSchedule("scheduleID"); // fill with schedule id
