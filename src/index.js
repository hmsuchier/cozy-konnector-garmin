const {
  BaseKonnector,
  requestFactory,

  scrape,
  saveBills,
  log
} = require('cozy-konnector-libs')
const request = requestFactory()

const baseUrl = 'https://connect.garmin.com/modern/'

const j = request.jar()

let ticket = null;

module.exports = new BaseKonnector(start)

async function start(fields) {
  log('info', 'Authenticating ...')
  await authenticate(fields.username, fields.password)
  log('info', 'Successfully logged in')
  // The BaseKonnector instance expects a Promise as return of the function
  log('info', 'Fetching the list of activities')
    
  const activities = await parseActivities(0, 10)

  let activity = activities[0]

  const summary = await parseActivitySummary(activity.activityId)

  const details = await parseActivityDetails(activity.activityId)

  log("info", summary)
  log("info", details)
}

// this shows authentication using the [signin function]
//(https://github.com/konnectors/libs/blob/master/packages/cozy-konnector-libs/docs/api.md#module_signin)
// even if this in another domain here, but it works as an example
async function authenticate(username, password) {
  
  //parameters for sso pre-start
  const arrParams = {
    service: 'https://connect.garmin.com/activities/',
    webhost: 'https://connect.garmin.com',
    source: 'https://connect.garmin.com/fr-FR/signin',
    clientId: 'GarminConnect',
    gauthHost: 'https://sso.garmin.com/sso',
    consumeServiceTicket: 'false',
    redirectAfterAccountLoginUrl:	'https://connect.garmin.com/modern/activities',
    redirectAfterAccountCreationUrl: 'https://connect.garmin.com/modern/activities',
    locale: 'fr_FR',
    id: 'gauth-widget'
  }

    const arrData = {
        "username": username,
        "password": password,
        "embed": "false",
    }

  //sso pre start
  return request.get({
    url: `https://sso.garmin.com/sso/login#`,
    qs: arrParams,
    jar: j
    }).then( x => {
       //actual login phase
      return request.post({
        url: `https://sso.garmin.com/sso/signin`,
        qs: arrParams,
        form: arrData,
        cheerio: false,
        jar: j

      }).then(x => {
        let reg= /\?ticket=([^\"]+)\"/gm  
          ticket = reg.exec(x)[1]

          return request.post({
            url: baseUrl,
            qs: {
              "ticket": ticket
            },
            simple:false,
            resolveWithFullResponse: true ,
            followAllRedirects: false,
            jar: j
          }).then(x => {
            if (x.statusCode === 302) {
              //catch redirect
              redirectUrl = x.rawHeaders[(x.rawHeaders.indexOf('Location')+1)]
              return request.get({
                url: redirectUrl,
                resolveWithFullResponse: true ,
                followAllRedirects: true,
                jar: j
              }).then(x => {
                log("info", "OK!!")
                return true
              }).catch (e => {
                return false
              })
            }
          }).catch(e => {
            log("warn", e)
            return false
          })
      }) 
    })
    .catch(
      e => log("warn", "SSO pre-start error")
    )
}

/**
 * 
 * @param {*} start 
 * @param {*} limit 
 */
function parseActivities(start, limit) {

  return request.get({
    url: baseUrl + 'proxy/activitylist-service/activities/search/activities',
    qs: {
      start: start,
      limit: limit
    },
    jar: j
  }).then(x => {
    return x
  }).catch(e => {
    log("warn", "list was not collected")
    return null
  })
}

//get activity summary
function parseActivitySummary(activityId) {

  return request.get({
    url: baseUrl + 'proxy/activity-service/activity/' + activityId,
    jar: j
  }).then(x => {
    return x
  }).catch(e => {
    log("warn", "activity was not collected", e)
    return null
  })
}

//get activity details
function parseActivityDetails(activityId) {

  return request.get({
    url: baseUrl + "proxy/activity-service/activity/" + activityId + '/details',
    jar: j
  }).then(x => {
    return x
  }).catch(e => {
    log("warn", "activity detail was not collected", e)
    return null
  })
}

// convert a price string to a float
function normalizePrice(price) {
  return parseFloat(price.replace('£', '').trim())
}