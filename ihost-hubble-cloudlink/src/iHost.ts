/** Interface with iHost */
export class iHost {

    /** iHost URL */
    static get baseURL() {
        return process.env.IHOST_URL || 'http://ihost.local'
    }

    /** Send a request to iHost */
    static async sendRequest(method: 'GET' | 'POST', endpoint: string, body: any, accessToken?: string) {

        // Request an access token
        let ihostResponse = await fetch(this.baseURL + endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': accessToken ? 'Bearer ' + accessToken : '',
            },
            body: body ? JSON.stringify(body) : null
        })

        // Decode JSON
        let ihostJSON = await ihostResponse.json()

        // Check if the user hasn't approved yet
        if (ihostJSON.error == 401) throw new Error('Please approve the CloudLink request in your iHost dashboard and try again.')
        if (ihostJSON.error) throw new Error('iHost error: ' + (ihostJSON.message || ihostJSON.error))

        // Done
        return ihostJSON

    }

    /** Get access token */
    static async loginAndGetAccessToken() {
    
        // Request an access token
        let json = await this.sendRequest('GET', '/open-api/v2/rest/bridge/access_token?app_name=Hubble+CloudLink', null)
        if (!json.data.token) throw new Error('iHost did not return an access token.')

        // Done
        return json.data.token

    }

    /** Send an event to iHost */
    static async sendEvent(accessToken: string, event: iHostEventRequest) {

        // Send event
        let json = await this.sendRequest('POST', '/open-api/v2/rest/thirdparty/event', event, accessToken)

        // Check for error
        if (json.header.name == 'ErrorResponse') {

            // Error!
            throw new Error(`iHost event error: type=${json.payload.type} description=${json.payload.description}`)

        }

        // Done
        return json

    }

    /** Get list of custom cards */
    static async getCards(accessToken: string) {

        // Get cards
        let json = await this.sendRequest('GET', '/open-api/v2/rest/ui/cards', null, accessToken)

        // Done
        return json

    }

    /** Create a custom card */
    static async createCard(accessToken: string, cardName: string, cardURL: string) {

        // Create card
        let json = await this.sendRequest('POST', '/open-api/v2/rest/ui/cards', {
            label: cardName,
            cast_settings: {
                default: '2×2',
                dimensions: [
                    {
                        src: cardURL,
                        size: '2×2',
                    },
                ]
            },
            web_settings: {
                default: '1×1',
                drawer_component: { src: cardURL },
                dimensions: [
                    {
                        src: cardURL,
                        size: '1×1',
                    },
                    {
                        src: cardURL,
                        size: '2×1',
                    },
                ]
            },
        }, accessToken)

        // Done
        return json

    }

}

/** Event request */
export interface iHostEventRequest {

    /** Request event object structure information */
    event: {

        /** Request header structure information */
        header: {

            /** Request name */
            name: 'DiscoveryRequest' | 'DeviceStatesChangeReport' | 'DeviceOnlineChangeReport'

            /** Message ID, uuidv4 */
            message_id: string

            /** Request protocol version number. Currently fixed at 1 */
            version: '2'

        }

        /** Request endpoint structure information. Note: This field is empty when sync a new device list. */
        endpoint?: {

            /** Device unique serial number */
            serial_number?: string

            /** Third-party device unique serial number */
            third_serial_number?: string

            /** JSON format key-value, custom device information. [Device Management Function] – [Tags Description] */
            tags?: any

        }

        /** Request payload structure information */
        payload: any

    }

}

/** Event response */
export interface iHostEventResponse {

    /** Response header structure information */
    header: iHostEventRequest['event']['header']

    /** Payload */
    payload: iHostEventResponseErrorPayload | any

}

/** Error response payload */
export interface iHostEventResponseErrorPayload {

    /** Error Types */
    type: 'INVALID_PARAMETERS' | 'AUTH_FAILURE' | 'INTERNAL_ERROR'

    /** Error description */
    description: string

}
