const { google } = require('googleapis');
const fastify = require('fastify');
const { v4: uuidv4 } = require('uuid');
const localtunnel = require('localtunnel');
const schedule = require('node-schedule');

// credentials 
const credential = require('./credentials.json');
const secret = credential.secret;
const clientId = credential.clientId;
const refreshToken = credential.refreshToken;
const calendarId = credential.calendarId;
const oAuth2Client = new google.auth.OAuth2(clientId, secret);

// configuration
const config = require('config');
const serverPort = config.get('server.port');
const skypeUrl = config.get('skype.url');
const server = fastify();


oAuth2Client.setCredentials(
  { refresh_token: refreshToken });
google.options({ auth: oAuth2Client });
const calendar = google.calendar({ version: 'v3' });

const startHttpServer = async () => {
  try {
    await server.listen(serverPort);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
startHttpServer();
const listenEvents = async () => {
  // Start the tunnel right after you start your Http server using fastify (see Handling the authorization callback step)
const tunnel = await localtunnel({
  port: serverPort
});

  try {
    await calendar.events.watch({
      resource: {
        id: uuidv4(),
        type: 'web_hook',
        address: `${tunnel.url}/webhook`,
      },
      calendarId: calendarId,
      singleEvents: true,
    });
  } catch (error) {
    console.log(error)
  }
}
listenEvents();

const moment = require('moment');
const httpRequest = require('request');
server.post('/webhook', async (request, reply) => {
  console.log('calling webhook')
  // Authorization details for google API are explained in previous steps.
  const calendar = google.calendar({ version: 'v3' });
  // Get the events that changed during the webhook timestamp by using timeMin property.
  const events = await calendar.events.list({
    calendarId: calendarId,
    maxResults: 30,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  schedule.gracefulShutdown();
  events.data.items.forEach((event) => {
    try {
      // not calling event without time
      if (!event.start.dateTime) {
        return null;
      }
      const today = new Date();
      const startDate = new Date(event.start.dateTime);
      const minusFiveMinutes = moment(startDate).subtract(5, "minute");
      const fiveMinutesAgo = minusFiveMinutes.format()
      if (today < new Date(fiveMinutesAgo)) {
        let data = {
          timeZone: event.start.timeZone,
          startTime: fiveMinutesAgo,
          summary: event.summary,
          creator: event.creator.email,
          description: event.description,
          attendees: event.attendees ? event.attendees : []
        };
        // scheduling process
        const {hour,minutes,day,month,year} = getScheduleDateTime(data.startTime)
        const job = schedule.scheduleJob({ hour: hour, minute: minutes, date: day, month: month, year: parseInt(year) }, async () => {
          httpRequest.post(`${skypeUrl}/send-message`,{ json: { email: data.creator, summary: data.summary, attendees: data.attendees } }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body) 
            }
          })
        });
      } else {
        console.log("Wrong Date");
        return false;
      }
    } catch (e) {
      console.log(e)
    }
  })
  return reply.status(200).send('Webhook received');
});
const getScheduleDateTime = (startTime) => {
  const filterTime = new Date(startTime).toTimeString();
  const day = startTime?.split("-")[2]?.split("T")[0];
  let month = parseInt(startTime.split("-")[1]);
  const year = startTime.split("-")[0];
  if (month == 12) {
    month = 0;
  }
  else {
    month = month - 1
  }
  const [hour, minutes, second] = filterTime.split(":");
  return {hour,minutes,day,month,year}
}