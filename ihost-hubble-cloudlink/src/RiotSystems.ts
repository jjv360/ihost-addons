import { jwtDecode } from "jwt-decode"
import { WebSocket } from "ws"

/** Riot Systems API */
export class RiotSystems {

    /** Decode JWT token */
    static decodeAccessToken(accessToken: string) : {

        /** Access token */
        accessToken: string,

        /** Data extracted from the JWT */
        userId: string,
        sessionId: string,
        firstName: string,
        lastName: string,
        tenantId: string,
        customerId: string,

    } {
        
        // Do it
        return {
            ...jwtDecode(accessToken),
            accessToken,
        }

    }

    /** Get access token */
    static async login(email: string, password: string) {

        // Send request
        let login = await fetch("https://portal.riotsystems.cloud/api/auth/login", {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: email,
                password: password,
            })
        }).then(r => r.json())
    
        // Get access token
        let accessToken = login.token
        if (!accessToken)
            throw new Error('No access token returned.')

        // Done
        return this.decodeAccessToken(accessToken)

    }

}

/** Command IDs. These are generated our side, usually unique but since our process is so simple we can hardcode them for simplicity */
const CommandID = {
    Auth: 0,
    QueryDeviceID: 1,
    QueryAttributes: 2,
}

/** Monitors a system */
export class RiotSystemsMonitor {

    /** WebSocket */
    ws: WebSocket

    /** Access token */
    accessToken: string

    /** Device ID */
    deviceID = ''

    /** Latest keys retrieved */
    retrievedKeys: any = {}

    /** Date of the last keys update */
    keysLastUpdatedAt = 0

    /** Callback when keys are updated */
    onKeysUpdated: null | (() => void) = null

    /** Check if connection has ended */
    get isClosed() {
        return this.ws.readyState === WebSocket.CLOSED
    }

    /** Constructor */
    constructor(accessToken: string) {
        this.accessToken = accessToken
        this.ws = new WebSocket('wss://portal.riotsystems.cloud/api/ws')
        this.ws.on('open', () => this.onOpen())
        this.ws.on('message', (data) => this.onMessage(data))
        this.ws.on('error', () => console.error('RiotSystems websockket connection error'))
    }

    /** Called when the connection opens */
    onOpen() {

        // Send auth command along with a command to query device ID
        this.ws.send(JSON.stringify({
            authCmd: {
                cmdId: CommandID.Auth,
                token: this.accessToken,
            },
            cmds: [
                {
                    cmdId: CommandID.QueryDeviceID,
                    type: 'ENTITY_DATA',
                    query: {
                        "entityFilter": {
                            "type": "deviceType",
                            "resolveMultiple": true,
                            "deviceNameFilter": "",
                            "deviceTypes": [
                                "Device_Profile_RIOT_CoudLink_1"
                            ]
                        },
                        "pageLink": {
                            "page": 0,
                            "pageSize": 1024,
                            "textSearch": null,
                            "dynamic": true,
                            "sortOrder": null
                        },
                        "entityFields": [
                            {
                                "type": "ENTITY_FIELD",
                                "key": "name"
                            },
                            {
                                "type": "ENTITY_FIELD",
                                "key": "label"
                            },
                            {
                                "type": "ENTITY_FIELD",
                                "key": "additionalInfo"
                            }
                        ],
                        "latestValues": []
                    }
                }
            ]
        }))

    }

    /** Called when a message is received */
    onMessage(data: any) {
        
        // Catch errors
        try {

            // Parse message
            let json = JSON.parse(data.toString())

            // Check messages
            console.log('Received message cmdId=' + json.cmdId)
            if (json.cmdId == CommandID.QueryDeviceID) this.onQueryDeviceID(json)
            if (json.cmdId == CommandID.QueryAttributes) this.onQueryAttributes(json)

        } catch (err) {

            // Failed
            console.error('Failed to parse message:', err)
            this.ws.close()

        }

    }

    /** Called when we receive an update for device ID */
    onQueryDeviceID(json: any) {

        // Only ever do once
        if (this.deviceID) return

        // Get device ID
        this.deviceID = json.data.data[0].entityId.id
        console.log('Device ID:', this.deviceID)

        // Create query for all data we need, this gets the latest values for all fields
        this.ws.send(JSON.stringify({
            "cmds": [
                {
                    "cmdId": CommandID.QueryAttributes,
                    "type": "ENTITY_DATA",
                    "query": {
                        "entityFilter": {
                            "type": "singleEntity",
                            "singleEntity": {
                                "id": this.deviceID,
                                "entityType": "DEVICE"
                            }
                        },
                        "pageLink": {
                            "pageSize": 1024,
                            "page": 0,
                            "sortOrder": {
                                "key": {
                                    "type": "ENTITY_FIELD",
                                    "key": "createdTime"
                                },
                                "direction": "DESC"
                            }
                        },
                        "entityFields": [
                            {
                                "type": "ENTITY_FIELD",
                                "key": "label"
                            },
                            {
                                "type": "ENTITY_FIELD",
                                "key": "name"
                            },
                            {
                                "type": "ENTITY_FIELD",
                                "key": "additionalInfo"
                            }
                        ],
                        "latestValues": [
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_Model_Bat"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_Brand_Inv"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "active"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Inv_Op_Mode"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_Site_MOD_Con_to"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_EM_Con"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Inv_Conn"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "SYS_P_EM"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Release_Rev"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_DCC_Enabled"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_DCC_UseEM"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Remote_Set_Voltronic"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_EM_Num_Devices"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Inv_Con"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Bat_Con"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_PV"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_Grid"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_Load"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_Bat"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_V_Bat"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_SOC"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_Percent_Load"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_Loc_Lat"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_Loc_Lon"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_NE"
                            }
                        ]
                    },
                }
            ]
        }))

        // Query realtime updates
        this.ws.send(JSON.stringify({
            "cmds": [
                {
                    "cmdId": CommandID.QueryAttributes,
                    "type": "ENTITY_DATA",
                    "latestCmd": {
                        "keys": [
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_Model_Bat"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_Brand_Inv"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "active"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Inv_Op_Mode"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_Site_MOD_Con_to"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_EM_Con"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Inv_Conn"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "SYS_P_EM"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Release_Rev"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_DCC_Enabled"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_DCC_UseEM"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Remote_Set_Voltronic"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Cfg_EM_Num_Devices"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Inv_Con"
                            },
                            {
                                "type": "ATTRIBUTE",
                                "key": "Sys_Bat_Con"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_PV"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_Grid"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_Load"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_Bat"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_V_Bat"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_SOC"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_Percent_Load"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_Loc_Lat"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_Loc_Lon"
                            },
                            {
                                "type": "TIME_SERIES",
                                "key": "Sys_P_NE"
                            }
                        ]
                    }
                }
            ]
        }))

    }

    /** Called when attribute key data is received */
    onQueryAttributes(json: any) {

        // Get items
        let items = {
            ...json.data?.data?.[0]?.latest?.ATTRIBUTE,
            ...json.data?.data?.[0]?.latest?.TIME_SERIES,
            ...json.update?.[0]?.latest?.ATTRIBUTE,
            ...json.update?.[0]?.latest?.TIME_SERIES,
            ...json.update?.[0]?.timeseries,
        }

        // Go through each one
        let didUpdate = false
        for (let key in items) {

            // Get value
            let value = items[key].value
            if (value === undefined) 
                continue

            // Save it
            didUpdate = true
            this.retrievedKeys[key] = value
            console.log('Key:', key, 'Value:', value)

        }

        // Notify
        this.keysLastUpdatedAt = Date.now()
        this.onKeysUpdated?.()

    }

}