import express from 'express'
import cors from 'cors'
import { RiotSystems, RiotSystemsMonitor } from './RiotSystems'
import { Settings } from './Settings'
import { iHost } from './iHost'
import { v4 as uuidv4 } from 'uuid'
import PackageJSON from '../package.json'

// Start function
async function start() {

    // Create express app
    console.debug('Starting server...')
    const app = express()

    // Add middleware
    app.use(cors())
    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))
    app.use(express.static('./public'))

    // Add routes
    app.post('/api/login', wrapError(onLogin))
    app.post('/api/status', wrapError(onStatus))

    // Start server
    const port = process.env.PORT || 9009
    const listener = app.listen(port, () => {
        console.debug('Server is running on ' + JSON.stringify(listener.address()))
    })

    // Start monitor loop
    while (true) {

        // Run an iteration
        try {
            console.log('Running iteration...')
            await runIteration()
        } catch (err) {
            console.warn(`Update failed: ${err.message}`)
        }

        // Wait a minute
        await new Promise(c => setTimeout(c, 5 * 1000))

    }

}

/** Error wrapper */
function wrapError(fn : (req : express.Request, res : express.Response) => Promise<any>) {

    // Return new function
    return async (req : express.Request, res : express.Response) => {

        // Run function with async error handling
        try {

            // Run it
            let response = await fn(req, res)

            // Return success response
            res.json(response)

        } catch (e) {

            // Failed, return error response
            console.error(e)
            res.status(500).json({ error: e.message })

        }

    }

}

/** Handle login */
async function onLogin(req : express.Request, res : express.Response) {

    // Get email and password
    let email = req.body.email
    let password = req.body.password
    if (!email || !password) throw new Error('Invalid email or password')

    // Get iHost access token
    let ihostAccessToken = await iHost.loginAndGetAccessToken()

    // Attempt to login
    await RiotSystems.login(email, password)

    // Save details
    Settings.instance.set('email', email)
    Settings.instance.set('password', password)
    Settings.instance.set('ihostAccessToken', ihostAccessToken)

    // Reset iteration
    connection?.ws?.close()

    // Done
    return { ok: true }

}

/** Current connection */
var connection: RiotSystemsMonitor | null = null

/** Run an iteration */
async function runIteration() {

    // Get email and password
    let email = Settings.instance.get('email')
    let password = Settings.instance.get('password')
    let ihostAccessToken = Settings.instance.get('ihostAccessToken')
    if (!email || !password || !ihostAccessToken)
        throw new Error('Not logged in.')

    // Get access token
    let user = await RiotSystems.login(email, password)

    // Open connection
    connection?.ws?.close()
    connection = new RiotSystemsMonitor(user.accessToken)

    // Send device list update to iHost
    console.log('Sending device discovery message to iHost...')
    let response = await iHost.sendEvent(ihostAccessToken, {
        event: {
            header: {
                name: 'DiscoveryRequest',
                message_id: uuidv4(),
                version: '2',
            },
            payload: {
                endpoints: [

                    // Our device
                    {
                        third_serial_number: 'hubble_cloudlink_device',
                        name: 'Hubble CloudLink',
                        manufacturer: 'Hubble',
                        model: 'CloudLink',
                        firmware_version: PackageJSON.version,
                        service_address: 'http://localhost:9009/api/ihost-service',
                        display_category: 'plug',
                        tags: {},
                        state: {
                            battery: { battery: -1 },
                            "electric-power": { "electric-power": 0 },
                        },
                        capabilities: [
                            { capability: 'battery', permission: '0110' },
                            { capability: 'electric-power', permission: '0110' },
                        ],
                    }

                ]
            }
        }
    })

    // Get "endpoint" which contains serial number from response
    let endpoint = response.payload.endpoints[0]

    // Get list of cards
    console.log('Checking cards...')
    let cards = await iHost.getCards(ihostAccessToken)
    let card = cards.data.find(c => c.label == 'Hubble CloudLink Usage')
    if (!card) {

        // Create card
        console.log('Creating card...')
        card = await iHost.createCard(ihostAccessToken, 'Hubble CloudLink Usage', 'http://ihost.local:9009/card.html')

    }
    
    // Monitor the connection
    let lastKeysUpdate = 0
    while (true) {

        // Check if connection ended
        if (!connection || connection.isClosed)
            break

        // Check if keys were updated
        if (connection.keysLastUpdatedAt == lastKeysUpdate && connection.keysLastUpdatedAt > 0 && Date.now() - connection.keysLastUpdatedAt > 1000 * 60 * 5) {

            // Connection hasn't received updates in 5 minutes, let's kill it and let it reconnect
            console.error('Connection is not receiving updated, reconnecting...')
            connection.ws.close()
            connection = null
            break

        } else if (connection.keysLastUpdatedAt == lastKeysUpdate) {
            
            // No update yet, wait a bit and try again
            await new Promise(c => setTimeout(c, 500))
            continue

        }

        // Update iHost with new values
        // See: https://github.com/jjv360/homeassistant-addons/blob/315cea76184f35793cce745a174145638e672a31/addon-hubble-cloudlink/src/index.js#L211
        lastKeysUpdate = connection.keysLastUpdatedAt
        console.log('Updating iHost...')
        await iHost.sendEvent(ihostAccessToken, {
            event: {
                header: {
                    name: 'DeviceStatesChangeReport',
                    message_id: uuidv4(),
                    version: '2',
                },
                endpoint,
                payload: {
                    state: {
                        battery: { battery: parseInt(connection.retrievedKeys['Sys_SOC']) || -1, },
                        "electric-power": { "electric-power": parseInt(connection.retrievedKeys['Sys_P_Grid'])*100 || 0, },
                    }
                }
            }
        })

    }

}

/** Handle sttaus check */
async function onStatus(req : express.Request, res : express.Response) {

    // Check if logged in
    let email = Settings.instance.get('email')
    let password = Settings.instance.get('password')
    let ihostAccessToken = Settings.instance.get('ihostAccessToken')
    if (!email || !password || !ihostAccessToken) return {
        ihostURL: process.env.IHOST_URL || 'http://ihost.local',
        loggedIn: false 
    }

    // Decode values from access token
    let user = connection?.accessToken ? RiotSystems.decodeAccessToken(connection.accessToken) : null
    if (user) {
        user.accessToken = ""
    }

    // Return current status of keys
    return {
        loggedIn: true,
        ihostURL: process.env.IHOST_URL || 'http://ihost.local',
        user,
        keys: connection?.retrievedKeys || {},
        keysLastUpdatedAt: connection?.keysLastUpdatedAt || 0,
    }

}

// Start the server
start()