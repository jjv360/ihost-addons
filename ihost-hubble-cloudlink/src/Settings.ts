import fs from 'node:fs'

/**
 * Handles storing user settings.
 */
export class Settings {

    /** Shared instance */
    static instance = new Settings();

    /** Current settings */
    settings : { [key: string]: any } = {}

    /** Constructor */
    constructor() {

        // Load settings if it exists
        if (fs.existsSync('./userdata/settings.json'))
            this.settings = JSON.parse(fs.readFileSync('./userdata/settings.json', 'utf8'))

    }

    /** Save settings */
    save() {

        // Ensure directory ./userdata exists
        if (!fs.existsSync('./userdata'))
            fs.mkdirSync('./userdata')

        // Save settings
        fs.writeFileSync('./userdata/settings.json', JSON.stringify(this.settings))

    }

    /** Get a value or use the default if not found */
    get(key : string, defaultValue : any = null) : any {
        return this.settings[key] || defaultValue
    }

    /** Set a value */
    set(key : string, value : any) {
        this.settings[key] = value
        this.save()
    }

}